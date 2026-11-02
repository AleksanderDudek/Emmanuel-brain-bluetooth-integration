/** A placeholder until the game is built (DESIGN.md §7): the registry can load it, nothing more. */
import { h } from '../../ui/dom';
import type { ArcadeModule } from '../kit/types';

const mod: ArcadeModule<{ sessions: number }> = {
  freshProgress: () => ({ sessions: 0 }),
  create: () => { throw new Error('zacheusz: not built yet'); },
  best: () => null,
  progressPanel: () => h('div', null),
  preview: () => undefined,
};
export default mod;
