import { describe, expect, it } from 'vitest';
import { ARCADE, gameOfDay, KINDS } from '../src/arcade/registry';
import { ActivitiesView, GAME_ACTIVITIES, TODAYS_GAME } from '../src/ui/activities';

describe('the Games tab', () => {
  it('names one game of the day, the same all day, and every game in turn over as many days', () => {
    const days = Array.from({ length: ARCADE.length }, (_, i) => new Date(Date.UTC(2026, 9, 24 + i)).toISOString().slice(0, 10));
    expect(new Set(days.map(d => gameOfDay(d).id)).size).toBe(ARCADE.length);
    expect(gameOfDay('2026-10-24').id).toBe(gameOfDay('2026-10-24').id);
    expect(TODAYS_GAME('2026-10-24').arcade?.id).toBe(gameOfDay('2026-10-24').id);
  });

  it('puts every arcade game in one of the sections', () => {
    for (const a of ARCADE) expect(KINDS, a.id).toContain(a.kind);
  });

  it('marks a game never played as new, and clears the mark once it has been played', () => {
    document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'list' }));
    const games = GAME_ACTIVITIES(), arcade = games.filter(a => a.arcade).map(a => a.id);
    const view = new ActivitiesView('list', games);
    const marked = () => [...document.querySelectorAll('.badge.new')].map(b => b.closest('[data-activity]')!.getAttribute('data-activity'));
    view.setPlayed(new Set());
    expect(marked()).toEqual(arcade);                       // HolyHolyHoly's games are not the arcade's: no mark
    expect(document.querySelector('.badge.new')!.textContent).toBe('Nowa');
    view.setPlayed(new Set(['latarnik']));
    expect(marked()).toEqual(arcade.filter(id => id !== 'latarnik'));
    view.setPlayed(new Set(['latarnik']));
    expect(document.querySelectorAll('[data-activity="geoda"] .badge.new')).toHaveLength(1);
  });
});
