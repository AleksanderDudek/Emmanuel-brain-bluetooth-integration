/**
 * The verse cards of the lobby (a game's root passage) and the runner's summary (the session's
 * closing one).  The passages (src/content/scripture.ts, all four languages) travel in a chunk of
 * their own that the games load with their code, so the app's first load does not carry them: the
 * slot fills in when that chunk is there, which after a game is at once.
 */
import { h } from '../ui/dom';
import type { PassageId } from './kit/scripture';

export function verseSlot(id: PassageId): HTMLElement {
  const slot = h('div', { class: 'verse-slot' });
  import('./kit/scripture').then(m => slot.replaceChildren(m.verseCard(id)), e => console.warn(`verse ${id}`, e));
  return slot;
}
