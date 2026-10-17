import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => Promise.resolve() }));

const { chapelScreen, levelUpScreen } = await import('../src/ui/screens');
const { Run, modsFrom, BASE_POOL } = await import('../src/sim/run');
const { CHAPTERS } = await import('../src/content');

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const button = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label)!;

describe('chapel screen', () => {
  it('settles once: "Pomiń" stops the contemplation timer, which must not bless later', () => {
    vi.useFakeTimers();
    const results: boolean[] = [];
    const el = chapelScreen('focus', false, ok => results.push(ok));
    document.body.append(el);
    button(el, 'Pomiń').click();
    button(el, 'Pomiń').click();
    vi.advanceTimersByTime(30_000);
    expect(results).toEqual([false]);
  });

  it('a right answer blesses once, however often Enter is pressed', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);   // first left task: 12 + 11
    const results: boolean[] = [];
    const el = chapelScreen('train_left', false, ok => results.push(ok));
    document.body.append(el);
    const input = el.querySelector('input')!;
    input.value = '23';
    for (let i = 0; i < 3; i++) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    button(el, 'Sprawdź').click();
    vi.advanceTimersByTime(2000);
    expect(results).toEqual([true]);
    expect(input.disabled).toBe(true);
  });
});

describe('level-up screen', () => {
  it('ignores a tap that lands as the cards appear, then takes exactly one pick', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const run = new Run(CHAPTERS[0], BASE_POOL, modsFrom({}, 0), false, 1);
    const picks: string[] = [];
    const el = levelUpScreen(run, run.offers(), o => picks.push(o));
    const cards = [...el.querySelectorAll<HTMLButtonElement>('.card')];
    cards[0].click();                 // the second half of a double tap on the previous screen
    expect(picks).toHaveLength(0);
    now += 400;
    cards[1].click();
    cards[2].click();
    expect(picks).toHaveLength(1);
  });
});
