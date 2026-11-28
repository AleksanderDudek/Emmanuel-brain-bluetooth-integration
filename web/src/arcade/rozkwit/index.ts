/**
 * Rozkwit (DESIGN.md §24, §29): a health library played by the section's engine (kit/healthlib) — with one thing of
 * its own around it: saves from before round 25 kept Lekkość i siła's figure (`ona`/`on`) as the look; Rozkwit's looks
 * are now Nowe siły's six (sources.ts), so an old figure is read as the first skin tone of that figure (`f1`/`m1`)
 * before the engine repairs the save (which would otherwise give everyone the first look).
 */
import type { ArcadeModule } from '../kit/types';
import { makeHealthModule, type HealthProgress } from '../kit/healthlib';
import { LIBRARY } from './library';
import { OLD_LOOK } from './sources';

/** An old save's look, read as Rozkwit's (in place; idempotent). */
export function migrateLook<P extends object>(p: P): P {
  const raw = p as unknown as { look?: unknown };
  if (raw && typeof raw.look === 'string' && OLD_LOOK[raw.look]) raw.look = OLD_LOOK[raw.look];
  return p;
}

const base = makeHealthModule(LIBRARY);

const module: ArcadeModule<HealthProgress> = {
  ...base,
  create: env => {
    migrateLook(env.progress);
    return base.create(env);
  },
  best: p => base.best(migrateLook(p)),
  progressPanel: (p, save) => base.progressPanel(migrateLook(p), save),
  preview: (ctx, w, h, t, p) => base.preview(ctx, w, h, t, p ? migrateLook(p) : p),
};

export default module;
