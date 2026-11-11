/**
 * Kocia straż's picture for the lobby's hero and the game card: the abbey wall over a field, three cats
 * firing at pests that come in (peas, a water jet, bubbles), the pests startled and bolting, the
 * gatehouse's eye breathing with a focus that comes and goes (its notch the threshold, gold beyond it),
 * and a fish flying to the bowl.  In the lobby (with progress) the place is the player's current one
 * and the cats are the player's squad.  Drawn every frame, so it stays cheap: no state.
 */
import { catSpec, stageInfo, type CatId, type PestId } from './content';
import type { KotyProgress } from './meta';
import { CAT_POSE, GOLD, ell, paintCat, paintCushion, paintEye, paintFish, paintGround, paintPest, paintSky, paintToy, paintWall } from './paint';

const PESTS_OF: Record<string, PestId[]> = {
  winnica: ['liszka', 'wrobel', 'liszka'], spichlerz: ['mysz', 'szczur', 'mysz'], sad: ['szpak', 'wrona', 'szpak'],
  warzywnik: ['zajac', 'slimak', 'mysz'], staw: ['kormoran', 'wydra', 'kormoran'], skryptorium: ['mol', 'rybik', 'kolatek'],
};

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: KotyProgress): void {
  const place = stageInfo(p?.stage ?? 1).place.id;
  const s = Math.max(10, Math.min(w / 12, h / 7));
  const skyH = h * 0.22, wallH = Math.max(18, h * 0.2), wallY = h - wallH;
  paintSky(ctx, place, 0, w, skyH, s);
  paintGround(ctx, place, 0, skyH, w, wallY - skyH, s);
  // the focus comes and goes: the eye breathes with it, and with it the cats' pace
  const level = 0.5 + 0.45 * Math.sin(t * 0.7);
  const gold = level >= 0.5;
  // pests coming in, startled when the shots land
  const kinds = PESTS_OF[place] ?? PESTS_OF.winnica;
  for (let i = 0; i < 3; i++) {
    const cyc = (t * 0.3 + i / 3) % 1;
    const x = w * (0.2 + i * 0.3) + Math.sin(t + i) * s * 0.3;
    const flee = cyc > 0.72;
    const y = flee ? skyH + (wallY - skyH) * (0.62 - (cyc - 0.72) * 2.5) : skyH + (wallY - skyH) * (0.12 + cyc * 0.6);
    paintPest(ctx, x, y, s * 1.05, kinds[i], { dir: i % 2 ? -1 : 1, t, hit: cyc > 0.62 && !flee ? 0.6 : 0, flee, doze: 0, frozen: false, elite: i === 1 && gold, move: flee ? 1 : 0.6, seed: i });
    // a shot on its way
    const sk = (t * (gold ? 2.2 : 1.3) + i * 0.37) % 1;
    const sx = w * (0.15 + i * 0.32), sy = wallY - wallH * 0.2;
    const px = sx + (x - sx) * sk, py = sy + (y - s * 0.3 - sy) * sk;
    ell(ctx, px, py, s * 0.1, s * 0.1);
    ctx.fillStyle = i === 1 ? '#8fd0ff' : gold ? GOLD : '#8ccf5a';
    ctx.fill();
  }
  paintWall(ctx, 0, wallY, w, wallH, s);
  const squad: CatId[] = p?.squad?.length ? p.squad.slice(0, 3) : ['mruczek', 'rudy', 'kluska'];
  const catH = Math.min(wallH * 1.35, w / 6);
  const xs = [w * 0.16, w * 0.36, w * 0.82];
  squad.forEach((id, i) => {
    const x = xs[i] ?? w * (0.2 + i * 0.25), y = wallY + wallH * 0.38;
    paintCushion(ctx, x, y, catH * 0.95, i, false, 0);
    paintCat(ctx, x, y, catH, catSpec(id), { ...CAT_POSE, gold, alert: level, t: t + i * 1.3, recoil: ((t * 2 + i) % 1) < 0.15 ? 1 : 0 });
    paintToy(ctx, x + catH * 0.27, y - catH * 0.42, catH * 0.42, i === 1 ? 'sikawka' : i === 2 ? 'banki' : 'proca', 2 + i, -0.4);
  });
  paintEye(ctx, w * 0.6, wallY + wallH * 0.46, Math.min(wallH * 0.48, w * 0.08), {
    value: level, mode: 'alert', charge: (t * 0.12) % 1, ready: false, mult: '', t, hunting: false,
  });
  // a fish flying to the bowl
  const fk = (t * 0.5) % 1;
  paintFish(ctx, w * (0.3 + fk * 0.6), skyH + (wallY - skyH) * (0.4 - Math.sin(fk * Math.PI) * 0.3), s * 0.18);
}
