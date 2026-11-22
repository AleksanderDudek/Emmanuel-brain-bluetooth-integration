/**
 * Drzewo nad wodą's picture for the lobby's hero and the game card, and the calibration's intro: the cross-section
 * drawn by the play view (render.ts) over a still session (`pose`) — in the lobby a loop of the meditation (the roots
 * go down to the stream, the tree rises through the figure, the nine fruits ripen one by one, a moment in full, again),
 * in the player's posture and season with the fruits they already carry; on the cards the same, generic.  The intro
 * stands still while the band settles: the figure on the ground, the soles warming as the reference fills.
 */
import { lang } from '../../i18n';
import { DEFAULT_TUNING } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { FRUITS } from './content';
import { dayKey } from '../kit/progress';
import { freshProgress, migrate, type DrzewoProgress } from './meta';
import { DrzewoView } from './render';
import { DrzewoSim } from './sim';

interface Scene { view: DrzewoView; sim: DrzewoSim; key: string }
const scenes = new WeakMap<HTMLCanvasElement, Scene>();

/** A still session for a picture: the player's posture, season and ripe fruits (or a generic one). */
function stillSim(p: DrzewoProgress | undefined): DrzewoSim {
  const prog = p ? migrate(JSON.parse(JSON.stringify(p)) as DrzewoProgress) : freshProgress();
  let a = 7;
  const rng = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  return new DrzewoSim({ progress: prog, rng, plannedSec: 600, eeg: false, tuning: DEFAULT_TUNING, day: dayKey() });
}

function sceneFor(ctx: CanvasRenderingContext2D, w: number, h: number, p: DrzewoProgress | undefined, tag: string, dprIn?: number): Scene {
  const dpr = dprIn ?? Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const key = `${tag}|${Math.round(w)}x${Math.round(h)}@${dpr}|${p?.posture ?? '-'}|${p?.season ?? '-'}|${p?.ripe?.join('') ?? ''}|${lang}`;
  const hit = scenes.get(ctx.canvas);
  if (hit && hit.key === key) return hit;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = new DrzewoView(ctx, { reducedMotion: reduced, touch: true, seed: 20261122, preview: true });
  view.resize(w, h, dpr, { top: 0, right: 0, bottom: 0, left: 0 });
  const s = { view, sim: stillSim(p), key };
  scenes.set(ctx.canvas, s);
  return s;
}

/** The loop's length (s): roots, tree, nine fruits, a moment in full. */
const LOOP = 26;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DrzewoProgress): void {
  if (w < 4 || h < 4) return;
  const s = sceneFor(ctx, w, h, p, 'preview');
  const sim = s.sim;
  // the cards (no progress): the tree whole with its nine fruits; the lobby: the meditation in a loop
  const u = p ? Math.max(0, t) % LOOP : LOOP - 1;
  const root = clamp(u / 5), tree = clamp((u - 5) / 6);
  sim.pose = { root: ease.inOutSine(root), tree };
  // the fruits: those the player carries hang from the crown; the others ripen one by one
  sim.hang.length = 0;
  const carried = p?.ripe ?? [];
  FRUITS.forEach((f, i) => {
    const ripe = carried[i] ? 1 : clamp((u - 11 - i * 1.1) / 1.1);
    if (ripe > 0) sim.hang.push({ fruit: f, ripe, before: false, slot: 0 });
  });
  sim.streamReached = u > 5;
  s.view.update(1 / 60, sim);
  s.view.draw(sim);
}

/** The calibration's intro: the scene still while the band settles. */
export class DrzewoIntro {
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: DrzewoProgress, dpr: number): void {
    if (w < 4 || h < 4) return;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    // the calibration card covers the lower part: the picture in the upper two thirds
    const s = sceneFor(ctx, w, h * 0.66, progress, 'intro', dpr);
    // nothing grows before play (growth comes only from focus): the scene waits
    s.sim.pose = { root: 0, tree: 0 };
    s.sim.hang.length = 0;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1224';
    ctx.fillRect(0, 0, w, h);
    s.view.update(dt, s.sim);
    s.view.draw(s.sim);
    ctx.restore();
  }
}
