import { describe, expect, it } from 'vitest';
import { FOCUS_TASKS, REST_TASKS, SignalDock, taskText, type BlockStart } from '../src/arcade/dock';
import { NEUTRAL_FRAME, type FocusFrame } from '../src/arcade/kit/focus';
import type { SignalPhase } from '../src/arcade/kit/types';

const BRAIN = { focus: 'the light grows', rest: 'the walls mend', meter: 'Light', meterRest: 'Walls' };
const frame = (activity: number, level = 0.7, calm = 0.3): FocusFrame => ({ ...NEUTRAL_FRAME, reliable: true, activity, threshold: 2, level, calm });

function feed(dock: SignalDock, t0: number, sec: number, phase: SignalPhase, f: FocusFrame): number {
  let t = t0;
  for (let s = 0; s < sec; s += 0.1) {
    t += 0.1;
    dock.push(t, f, phase, 0.1);
  }
  return t;
}

describe('the signal dock', () => {
  it('turns the strategies block by block, and wraps around', () => {
    const focus = Array.from({ length: FOCUS_TASKS }, (_, i) => taskText('focus', i));
    expect(new Set(focus).size).toBe(FOCUS_TASKS);
    expect(taskText('focus', FOCUS_TASKS)).toBe(focus[0]);
    expect(taskText('rest', -1)).toBe(taskText('rest', REST_TASKS - 1));
  });

  it('announces each push and rest block once, with its task and what the band drives', () => {
    const dock = new SignalDock('fnirs', BRAIN);
    const seen: BlockStart[] = [];
    dock.onBlock = b => seen.push(b);
    let t = feed(dock, 0, 10, { want: 'free', blind: false }, frame(1));
    expect(seen).toHaveLength(0);
    t = feed(dock, t, 20, { want: 'focus', blind: false }, frame(4));
    t = feed(dock, t, 20, { want: 'rest', blind: false }, frame(0, 0.2, 0.8));
    t = feed(dock, t, 5, { want: 'focus', blind: true }, frame(4));
    // the veil lifts inside the same push (a game's telegraph): no new announcement
    feed(dock, t, 5, { want: 'focus', blind: false }, frame(4));
    expect(seen.map(b => [b.want, b.blind, b.effect])).toEqual([
      ['focus', false, 'the light grows'], ['rest', false, 'the walls mend'], ['focus', true, 'the light grows'],
    ]);
    expect(seen[0].task).not.toBe(seen[2].task);
  });

  it('shows the game’s gauge: level in focus, calm in rest, nothing in a blind block', () => {
    const dock = new SignalDock('fnirs', BRAIN);
    const text = () => dock.el.querySelector('.dock-meter')!.textContent ?? '';
    let t = feed(dock, 0, 3, { want: 'focus', blind: false }, frame(4, 0.72));
    expect(text()).toContain('Light');
    expect(text()).toContain('72%');
    t = feed(dock, t, 3, { want: 'rest', blind: false }, frame(0, 0.2, 0.64));
    expect(text()).toContain('Walls');
    expect(text()).toContain('64%');
    feed(dock, t, 3, { want: 'focus', blind: true }, frame(4, 0.9));
    expect(text()).not.toContain('90%');
  });
});
