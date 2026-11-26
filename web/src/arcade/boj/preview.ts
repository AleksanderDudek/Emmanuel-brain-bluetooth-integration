/**
 * Dobry bój's lobby hero and the calibration intro (DESIGN.md §25, builder B): the ring (or the cage) under its one
 * warm light, the player's fighter (their look) in guard facing an opponent of the same division, gloves up, the
 * crowd's small lights in the dark.  A desk's hero is as tall as the lobby's card beside it: the scene is framed in a
 * band at the hero's top (at most as tall as it is wide) and the canvas floor and the apron run on below it.
 */
import type { Style } from './moves';
import { C, glow } from './paint';
import { BUILD, Rig, paintFighter, paintShadow, type Paint } from './rig';
import { Hall, crowdLights, dust, ringBack, ringFront, type Cam } from './stage';
import type { Look } from './view';

const ME: Look = { sex: 'on', skin: 2, hair: 0, kit: '#2c5aa0', gloves: '#c0342f' };
const FOE: Readonly<Record<Look['sex'], Look>> = {
  on: { sex: 'on', skin: 4, hair: 2, kit: '#a8443a', gloves: '#f0c040' },
  ona: { sex: 'ona', skin: 4, hair: 2, kit: '#a8443a', gloves: '#f0c040' },
};

const hall = new Hall();
const rigs = new Map<string, Rig>();
const rigOf = (key: string, sex: Look['sex'], style: Style): Rig => {
  const k = `${key}|${sex}|${style}`;
  let r = rigs.get(k);
  if (!r) { r = new Rig(BUILD[sex], style); rigs.set(k, r); }
  return r;
};

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, look?: Look, style?: Style): void {
  if (!(w > 0) || !(h > 0)) return;
  const st: Style = style === 'mma' ? 'mma' : 'boks';
  const me = look ?? ME;
  const foe = { ...FOE[me.sex === 'ona' ? 'ona' : 'on'] };
  // the opponent never wears the player's colours
  if (foe.kit.toLowerCase() === me.kit.toLowerCase()) foe.kit = '#3f8f6b';
  const dpr = ctx.getTransform().a || 1;
  ctx.save();
  // the scene's band: a phone's hero and a card carry the title over their lower part — the fighters stand in the
  // upper two thirds, the canvas floor runs on under the words; a desk's tall hero frames them at its top, at most as
  // tall as it is wide, with room round them
  const D = 0.7;
  const narrow = w < 560;
  const hv = Math.min(h, w);
  const fy = narrow ? h * 0.64 : Math.min(h - 6, hv * 0.84);
  const s = narrow ? Math.min((fy * 0.86) / 1.0, w / (D + 1.1)) : Math.min((hv * 0.66) / 1.08, w / (D + 1.25));
  const cam: Cam = { cx: 0, s, ox: w / 2, fy };
  hall.bake(w, h, dpr, st, cam);
  hall.draw(ctx, w, h, cam, st);
  crowdLights(ctx, cam, w, time, 0.55, false);
  ringBack(ctx, cam, w, h, st, 1);
  ringFront(ctx, cam, w, h, st);
  const c = { style: st, D, time: time * 0.9 };
  const rm = rigOf('me', me.sex, st), rf = rigOf('foe', foe.sex, st);
  const jm = rm.set({ kind: 'guard' }, 0, c);
  const jf = rf.set({ kind: 'guard' }, 0, { ...c, time: time * 0.9 + 0.37 });
  const pm: Paint = { look: me, style: st, facing: 1, x: w / 2 - (D / 2) * s, y: fy, s };
  const pf: Paint = { look: foe, style: st, facing: -1, x: w / 2 + (D / 2) * s, y: fy, s };
  paintShadow(ctx, jm, rm.build, pm);
  paintShadow(ctx, jf, rf.build, pf);
  for (const layer of ['far', 'body', 'near', 'top'] as const) {
    paintFighter(ctx, jf, rf.build, pf, { kind: 'guard' }, layer);
    paintFighter(ctx, jm, rm.build, pm, { kind: 'guard' }, layer);
  }
  dust(ctx, cam, time, 1, false);
  // a warm breath of the light over the two, slow
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.warm, w / 2, fy - s * 0.75, s * 0.9, 0.08 + 0.04 * Math.sin(time * 0.7));
  ctx.globalCompositeOperation = 'source-over';
  // a soft vignette
  const vg = ctx.createRadialGradient(w / 2, hv * 0.55, Math.min(w, hv) * 0.3, w / 2, hv * 0.55, Math.hypot(w, h) * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(6,4,8,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
