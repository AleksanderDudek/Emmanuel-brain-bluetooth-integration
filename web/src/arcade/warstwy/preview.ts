/**
 * Warstwy światła around play: the lobby's hero picture and the Games tab's card — the figure in its egg of seven
 * layers, the inner three already clear, the fourth (the rose light of relationships) open, a cord rising on its
 * thread of light to the Light above, the outer layers still dull.  Each size bakes once (paint.ts) and keeps it; a
 * frame composes it.
 */
import { mulberry32 } from '../../core/random';
import { NO_INSETS } from '../kit/mobile';
import { EGG_BOTTOM, EGG_HALF, EGG_TOP, placeHooks } from './egg';
import { layout, type Layout } from './layout';
import type { WarstwyProgress } from './meta';
import { Scene, type SceneState } from './render';
import type { Hook, LayerRun, LayerState } from './sim';

/** A layout for a picture without the play's words: the whole canvas is the stage. */
function pictureLayout(w: number, h: number): Layout {
  const base = layout(Math.max(120, w), Math.max(80, h), NO_INSETS, true);
  const H = Math.max(30, Math.min((h * 0.94) / (EGG_BOTTOM - EGG_TOP + 0.16), (w * 0.94) / (2 * EGG_HALF + 0.1)));
  const cx = w / 2;
  const eggTop = (h - (EGG_BOTTOM - EGG_TOP) * H) / 2 + 0.07 * H;
  const top = eggTop - EGG_TOP * H;
  const ex = (EGG_HALF + 0.08) * H;
  return {
    ...base, w, h, shape: h >= w ? 'tall' : 'desk', top: 0, bottom: h, left: 0, right: w,
    stage: { x: 0, y: 0, w, h }, fig: { cx, top, H },
    egg: { x: cx - ex, y: top + (EGG_TOP - 0.06) * H, w: 2 * ex, h: (EGG_BOTTOM - EGG_TOP + 0.12) * H },
    light: { x: cx, y: Math.max(6, eggTop - 0.1 * H), r: Math.max(10, 0.13 * H) },
    band: { x: 0, y: h, w: 0, h: 0 },
  };
}

type Fake = Pick<LayerRun, 'state' | 'healAt' | 'glow' | 'hooks'>;

/** The picture's layers: the inner `clear` layers clear, the next open with its things, the rest dull. */
function fakeLayers(clear: number): Fake[] {
  const rng = mulberry32(2424);
  return Array.from({ length: 7 }, (_, k) => {
    const state: LayerState = k < clear ? 'clear' : k === clear ? 'open' : 'wait';
    const hooks: Hook[] = placeHooks(k, 3, rng).map((s, i) => ({
      ...s, layer: k, i, state: k < clear ? 'gone' : 'cling', p: 0, grace: false, graceFrom: 0, graceTo: 0, goneAt: -100,
    }));
    return { state, healAt: -100, glow: k < clear ? 0.7 : 0, hooks };
  });
}

interface Baked { key: string; scene: Scene; layers: Fake[] }
const cache = new Map<string, Baked>();

function baked(w: number, h: number): Baked {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = pictureLayout(w, h);
  const scene = new Scene(L);
  scene.resize(L, 2);
  const b: Baked = { key, scene, layers: fakeLayers(3) };
  if (cache.size > 6) cache.clear();
  cache.set(key, b);
  return b;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, _p?: WarstwyProgress): void {
  if (w < 4 || h < 4) return;
  const b = baked(w, h);
  // the open layer's things: one already given, one rising on its thread (again and again), one waiting
  const open = b.layers[3];
  const k = (time % 9) / 9;
  open.hooks[0].state = 'gone';
  const h1 = open.hooks[1];
  h1.state = 'draw';
  h1.p = Math.min(0.999, k * 1.05);
  const s: SceneState = {
    time, layers: b.layers, open: 3, now: time, light: 0.75, drawing: true, dim: false,
    finale: 0, flare: 0.15 + 0.15 * Math.sin(time * 0.7), reduced: false,
  };
  b.scene.update(1 / 60);
  b.scene.prepare(s);
  ctx.save();
  b.scene.draw(ctx, s);
  ctx.restore();
}
