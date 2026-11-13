/**
 * Games in every menu (src/ui/game-strip.ts): each view's strip picks its own games — the game of the day,
 * what was played, the unplayed visualisation and body games, the lobby's neighbours — and never runs short.
 */
import { describe, expect, it } from 'vitest';
import { GAME_ACTIVITIES } from '../src/ui/activities';
import { pickGames } from '../src/ui/game-strip';

const all = GAME_ACTIVITIES();
const ids = (kind: Parameters<typeof pickGames>[0], ctx: Parameters<typeof pickGames>[2], max?: number) => pickGames(kind, all, ctx, max).map(a => a.id);

describe('the games strip', () => {
  it('puts the game of the day first in the training and signal views', () => {
    expect(ids('training', { today: 'geoda', recent: [] })[0]).toBe('geoda');
    expect(ids('signal', { today: 'koty', recent: ['latarnik'] })[0]).toBe('koty');
  });

  it('offers the unplayed visualisation and body games after it in the training view', () => {
    const list = pickGames('training', all, { today: 'geoda', recent: ['ogien'] });
    const kinds = list.slice(1, 7).map(a => a.arcade?.kind);
    expect(kinds.every(k => k === 'vision' || k === 'body')).toBe(true);
    expect(list.slice(1, 7).map(a => a.id)).not.toContain('ogien');   // played: it comes after the new ones
  });

  it('plays again what was played, most recent first', () => {
    expect(ids('again', { today: 'geoda', recent: ['rzeki', 'jestem', 'latarnik'] }).slice(0, 4)).toEqual(['rzeki', 'jestem', 'latarnik', 'geoda']);
  });

  it('shows a lobby its own section first and never itself', () => {
    const list = pickGames('more', all, { today: 'geoda', recent: [], current: 'synapsy' });
    expect(list.map(a => a.id)).not.toContain('synapsy');
    expect(list.slice(0, 3).every(a => a.arcade?.kind === 'body')).toBe(true);
  });

  it('never repeats a game and fills up to its length', () => {
    for (const kind of ['training', 'signal', 'again', 'settings', 'more'] as const) {
      const list = ids(kind, { today: 'pasterz', recent: ['pasterz', 'pasterz', 'arka'], current: kind === 'more' ? 'arka' : null }, 12);
      expect(new Set(list).size, kind).toBe(list.length);
      expect(list.length, kind).toBe(12);
    }
  });
});
