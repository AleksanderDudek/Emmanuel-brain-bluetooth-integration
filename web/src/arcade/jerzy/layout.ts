/**
 * Where Jerzy i smok's play view puts things (CSS px), for desktops and for phones upright and on
 * their side.  The runner's standard HUD covers the top (its Mendi panel on the left and the score on
 * the right, down to `hudTop`); its bottom strip (the banner, the simulator's switch) keeps the last
 * `BOTTOM` px.  The knight stands in the middle of the band between them and the field runs under
 * everything; the game's own bits — the hearts, the level's bar, the build, the treasures, the Miecz
 * światła's dial, the dragon's bar — sit at the band's edges.
 *
 * A phone on its side (short and wide) has almost no band between the HUD and the bottom strip, so
 * there the game's own bits move up into the free strip between the runner's panel and its score,
 * the knight stands in the middle of the whole canvas, and the field is drawn smaller so the shield's
 * widest ring still fits on the screen.
 */
import { clamp } from '../kit/juice';

export const BOTTOM = 62;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** the runner's HUD bottom, the play band's bottom */
  top: number;
  bottom: number;
  /** UI scale (1 on a desktop) */
  u: number;
  /** px per u of the field, and where the knight stands (px) */
  s: number;
  kx: number;
  ky: number;
  /** the half-size of the field in sight (u) */
  halfW: number;
  halfH: number;
  /** the level's bar, the hearts' row, the build's chips (left edge, y), the sword's dial (centre, radius) */
  xp: Rect;
  heartsY: number;
  buildY: number;
  /** show the build's chips (not on a very short screen) */
  showBuild: boolean;
  sword: { x: number; y: number; r: number };
  /** the dragon's bar under the HUD, and where banners go */
  boss: Rect;
  bannerY: number;
  /** the cards: narrow screens stack them */
  narrow: boolean;
  /** a phone on its side: the bits sit in the top strip between the runner's panel and score */
  land: boolean;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const u = clamp(Math.min(w / 900, h / 640), 0.72, 1.15);
  const top = clamp(hudTop || 64, 40, h * 0.5);
  const bottom = h - BOTTOM;
  const land = h < 470 && w > h * 1.4 && w >= 600;
  if (land) {
    // the free strip at the top: right of the runner's panel (≈ 330 px), left of its score (≈ 150 px)
    const sx0 = Math.min(w * 0.45, 360), sx1 = Math.max(sx0 + 160, w - 158);
    const stripW = sx1 - sx0;
    const s = clamp(Math.min(w / 17, (h - 54) / 8.4), 22, 40);
    const kx = w / 2, ky = clamp(top + (bottom - top) * 0.5, 54 + s * 3.6, h - s * 1.6);
    const xpH = 7;
    const xp = { x: sx0, y: 92, w: stripW, h: xpH };
    const sr = 22 * u;
    return {
      w, h, top, bottom, u, s, kx, ky, halfW: Math.max(kx, w - kx) / s, halfH: Math.max(ky, h - ky) / s, xp,
      heartsY: 78, buildY: 0, showBuild: false,
      sword: { x: w - 14 - sr, y: clamp(ky, top + sr + 18, bottom - sr), r: sr },
      boss: { x: sx0, y: 104, w: stripW, h: 18 },
      bannerY: Math.max(top + 18, ky - s * 2.6),
      narrow: false, land: true,
    };
  }
  const s = clamp(Math.min(w, h - top * 0.5) / 11, 30, 56);
  const kx = w / 2;
  const ky = top + (bottom - top) * 0.55;
  const halfW = Math.max(kx, w - kx) / s;
  const halfH = Math.max(ky, h - ky) / s;
  const m = 14 * u;
  const xpH = Math.max(8, 10 * u);
  const xpW = Math.min(w - 2 * m, 640 * u);
  const xp = { x: (w - xpW) / 2, y: bottom - xpH - 4, w: xpW, h: xpH };
  const sr = 25 * u;
  const bw = Math.min(w - 2 * m, 420 * u);
  return {
    w, h, top, bottom, u, s, kx, ky, halfW, halfH, xp,
    heartsY: xp.y - 18 * u,
    buildY: xp.y - 44 * u,
    showBuild: h >= 340,
    sword: { x: w - m - sr, y: xp.y - 34 * u - sr, r: sr },
    boss: { x: (w - bw) / 2, y: top + 4, w: bw, h: 26 * u },
    bannerY: top + 64 * u,
    narrow: w < 600,
    land: false,
  };
}
