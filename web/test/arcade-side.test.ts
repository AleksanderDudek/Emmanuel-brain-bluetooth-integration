/**
 * The big screen's left column (DESIGN §14.2): the how-to with the keys, and `fitSide`, which drops whole
 * tips from the last, then the goal, until the column fits its room — a sentence is never cut off.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/arcade';
import { fitSide, howToSide } from '../src/arcade/mendi';
import { arcadeEntry } from '../src/arcade/registry';

/**
 * A column whose content is 140 px (the title and the hands), 60 more for the goal and 60 a visible tip, in
 * `room` px (happy-dom has no layout).
 */
function column(room: number, tips = ['Pierwsza rada.', 'Druga rada.', 'Trzecia rada.']) {
  const entry = arcadeEntry('geoda')!;
  const side = document.createElement('aside');
  side.append(howToSide(entry, { goal: 'Cel.', hands: [{ gesture: 'tap', text: 'Kliknij.' }, { gesture: 'keys', text: 'Spacja.' }], tips }, 'fnirs'));
  const shown = () => [...side.querySelectorAll('.how-tips li')].filter(li => !li.classList.contains('is-off')).length;
  const goal = () => !side.querySelector('.how-goal')!.classList.contains('is-off');
  const content = () => 140 + (goal() ? 60 : 0) + 60 * shown();
  Object.defineProperty(side, 'scrollHeight', { get: content });
  Object.defineProperty(side, 'clientHeight', { get: () => Math.min(room, content()) });
  return { side, shown, goal, grow: (to: number) => { room = to; } };
}

describe('the big screen’s left column', () => {
  it('lists the keys with the hands, and a click for a tap', () => {
    const { side } = column(1000);
    const chips = [...side.querySelectorAll('.ban-chip')].map(c => c.textContent);
    expect(chips).toHaveLength(2);
    expect(chips[0]).toBe(t('gest.click'));
    expect(chips[1]).toBe(t('gest.keys'));
    expect(side.textContent).toContain('Spacja.');
  });

  it('keeps the goal and every tip when the room holds them, and fades nothing', () => {
    const { side, shown, goal } = column(1000);
    fitSide(side);
    expect(shown()).toBe(2);   // the how-to shows at most two tips
    expect(goal()).toBe(true);
    expect(side.classList.contains('clip')).toBe(false);
  });

  it('drops whole tips from the last until the column fits', () => {
    const { side, shown, goal } = column(270);
    fitSide(side);
    expect(shown()).toBe(1);
    const tips = [...side.querySelectorAll('.how-tips li')];
    expect(tips[0].classList.contains('is-off')).toBe(false);
    expect(tips[1].classList.contains('is-off')).toBe(true);
    expect(goal()).toBe(true);
    expect(side.classList.contains('clip')).toBe(false);
  });

  it('drops the tips’ list when none fits, and keeps the goal while it fits', () => {
    const { side, shown, goal } = column(200);
    fitSide(side);
    expect(shown()).toBe(0);
    expect(side.querySelector('.how-tips')!.classList.contains('is-off')).toBe(true);
    expect(goal()).toBe(true);
    expect(side.classList.contains('clip')).toBe(false);
  });

  it('drops the goal before it cuts the hands, and fades only what still overflows', () => {
    const roomy = column(150);
    fitSide(roomy.side);
    expect(roomy.goal()).toBe(false);
    expect(roomy.side.classList.contains('clip')).toBe(false);
    const short = column(100);
    fitSide(short.side);
    expect(short.goal()).toBe(false);
    expect(short.side.classList.contains('clip')).toBe(true);
  });

  it('gives the goal and the tips back when the window grows', () => {
    const { side, shown, goal, grow } = column(100);
    fitSide(side);
    grow(1000);
    fitSide(side);
    expect(shown()).toBe(2);
    expect(goal()).toBe(true);
    expect(side.querySelector('.how-tips')!.classList.contains('is-off')).toBe(false);
    expect(side.classList.contains('clip')).toBe(false);
  });
});
