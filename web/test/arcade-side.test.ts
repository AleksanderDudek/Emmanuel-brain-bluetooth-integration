/**
 * The big screen's left column (DESIGN §14.2): the how-to with the keys, and `fitSide`, which drops whole
 * tips from the last until the column fits its room — a sentence is never cut off.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/arcade';
import { fitSide, howToSide } from '../src/arcade/mendi';
import { arcadeEntry } from '../src/arcade/registry';

/** A column whose content is 200 px plus 60 px a visible tip, in `room` px (happy-dom has no layout). */
function column(room: number, tips = ['Pierwsza rada.', 'Druga rada.', 'Trzecia rada.']) {
  const entry = arcadeEntry('geoda')!;
  const side = document.createElement('aside');
  side.append(howToSide(entry, { goal: 'Cel.', hands: [{ gesture: 'tap', text: 'Kliknij.' }, { gesture: 'keys', text: 'Spacja.' }], tips }, 'fnirs'));
  const shown = () => [...side.querySelectorAll('.how-tips li')].filter(li => !li.classList.contains('is-off')).length;
  Object.defineProperty(side, 'scrollHeight', { get: () => 200 + 60 * shown() });
  Object.defineProperty(side, 'clientHeight', { get: () => Math.min(room, 200 + 60 * shown()) });
  return { side, shown, grow: (to: number) => { room = to; } };
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

  it('keeps every tip when the room holds them, and fades nothing', () => {
    const { side, shown } = column(1000);
    fitSide(side);
    expect(shown()).toBe(2);   // the how-to shows at most two tips
    expect(side.classList.contains('clip')).toBe(false);
  });

  it('drops whole tips from the last until the column fits', () => {
    const { side, shown } = column(270);
    fitSide(side);
    expect(shown()).toBe(1);
    const tips = [...side.querySelectorAll('.how-tips li')];
    expect(tips[0].classList.contains('is-off')).toBe(false);
    expect(tips[1].classList.contains('is-off')).toBe(true);
    expect(side.classList.contains('clip')).toBe(false);
  });

  it('drops the tips’ list when none fits, and fades only what still overflows', () => {
    const { side, shown } = column(150);
    fitSide(side);
    expect(shown()).toBe(0);
    expect(side.querySelector('.how-tips')!.classList.contains('is-off')).toBe(true);
    expect(side.classList.contains('clip')).toBe(true);
  });

  it('gives the tips back when the window grows', () => {
    const { side, shown, grow } = column(150);
    fitSide(side);
    grow(1000);
    fitSide(side);
    expect(shown()).toBe(2);
    expect(side.querySelector('.how-tips')!.classList.contains('is-off')).toBe(false);
    expect(side.classList.contains('clip')).toBe(false);
  });
});
