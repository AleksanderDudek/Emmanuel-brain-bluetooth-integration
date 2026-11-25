/**
 * Ogród o świcie's lobby section "Twoja droga" (DESIGN.md §23): the way and what the player brings to each station.
 * CONTRACT (lead): builder B owns this file and fills it; builder A's panel.ts (the game's lobby card) appends
 * `prepPanel(progress.prep, save, sessionSec)` as one section, and `weekCard(progress.prep, progress.week)` where the
 * card shows what the last session left for the week.  LEAD STUB until B's version lands.
 */
import { h } from '../../ui/dom';
import type { GardenPrep } from './prep';

/** What the last session left for the week (kept by A's meta.ts after a session; B's card shows it in the lobby). */
export interface Week {
  /** the day of the session (YYYY-MM-DD) */
  day: string;
  /** the boundary chosen for the week (a set's key), the friends' names to reach out to, the seeds to tend */
  intention: string | null;
  friends: string[];
  seeds: string[];
}

/**
 * The lobby section: `save()` after every change; `sessionSec()` reads the lobby's chosen length (as serce/panel.ts
 * sessionSec does) so the way can say what fits.
 */
export function prepPanel(p: GardenPrep, save: () => void, sessionSec: () => number): HTMLElement {
  void p; void save; void sessionSec;
  return h('section', { class: 'og-prep' });
}

/** The week's card (null: nothing to show). */
export function weekCard(p: GardenPrep, week: Week | null): HTMLElement | null {
  void p; void week;
  return null;
}
