// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PACER_BIG_RING, PACER_RING, pacerBox, pacerLeastOf, pacerRing, pacerSize, pacerSizeAt, pacerSpot } from '../src/arcade/kit/pacerspot';
import { BreathPacer } from '../src/arcade/pacer';

type R = { x: number; y: number; w: number; h: number };
const cover = (a: R, b: R) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

describe('kit/pacerspot: the ring alone where the pill has no room', () => {
  it('sizes the ring square, a third of the pill or less, and bigger on a big screen', () => {
    expect(pacerSize(false, true)).toEqual({ w: PACER_RING, h: PACER_RING });
    expect(pacerSize(true, true)).toEqual({ w: PACER_BIG_RING, h: PACER_BIG_RING });
    for (const big of [false, true]) {
      const p = pacerSize(big), r = pacerSize(big, true);
      expect(r.w * r.h).toBeLessThanOrEqual((p.w * p.h) / 2.5);
      expect(r.h).toBeGreaterThanOrEqual(p.h);
    }
    expect(pacerSizeAt({ x: 0, y: 0, ring: true }, false)).toEqual(pacerSize(false, true));
    expect(pacerSizeAt({ x: 0, y: 0 }, false)).toEqual(pacerSize(false));
    expect(pacerSizeAt(null, true)).toEqual(pacerSize(true));
  });

  // a 360-wide band whose board leaves 90 px each side: no room for the 210-px pill, room for the ring
  const band = { x: 0, y: 100, w: 360, h: 400 };
  const board = { x: 90, y: 100, w: 180, h: 400 };

  it('finds the ring a place clear of the play where the pill finds none, and marks it', () => {
    expect(pacerSpot([band], [board])).toBeNull();
    const at = pacerRing([band], [board])!;
    expect(at.ring).toBe(true);
    expect(cover(pacerBox(at, pacerSize(false, true)), board)).toBe(0);
    const box = pacerBox(at, pacerSize(false, true));
    expect(box.x).toBeGreaterThanOrEqual(band.x);
    expect(box.x + box.w).toBeLessThanOrEqual(band.x + band.w);
    expect(pacerRing([band], [{ x: 40, y: 100, w: 280, h: 400 }])).toBeNull();
  });

  it('falls back to whichever of the pill and the ring covers less of the play, the pill on a tie or where the ring has no room', () => {
    // the board fills the band but for 40 px each side: both cover some of it, the ring far less
    const full = { x: 40, y: 100, w: 280, h: 400 };
    const at = pacerLeastOf([band], [], [full])!;
    expect(at.ring).toBe(true);
    expect(cover(pacerBox(at, pacerSize(false, true)), full)).toBeLessThan(cover(pacerBox({ x: 180, y: 100 }, pacerSize(false)), full) / 2);
    // nothing to cover: the pill (its phase word helps)
    expect(pacerLeastOf([band], [], [])!.ring).toBeFalsy();
    // a strip the pill fits and the ring does not (79 px tall less the 4-px edges): the pill
    const strip = { x: 0, y: 100, w: 220, h: 79 };
    const s = pacerLeastOf([strip], [], [full])!;
    expect(s).not.toBeNull();
    expect(s.ring).toBeFalsy();
  });
});

describe('the runner\'s pacer shows the ring alone where the game asks for it', () => {
  it('toggles .ring with the spot, keeps the phase word for screen readers, and its stylesheet hides the word', () => {
    const p = new BreathPacer();
    p.update({ b: { phase: 'in', n: 0, p: 0.2, k: 0.2, left: 3.2 }, n: 1, of: 6 });
    p.place({ x: 40, y: 200, ring: true }, { left: 0, top: 0 });
    expect(p.el.classList.contains('ring')).toBe(true);
    expect(p.el.classList.contains('placed')).toBe(true);
    expect(p.el.getAttribute('aria-label')).toBeTruthy();
    p.place({ x: 180, y: 140 }, { left: 0, top: 0 });
    expect(p.el.classList.contains('ring')).toBe(false);
    p.place({ x: 40, y: 200, ring: true }, { left: 0, top: 0 });
    p.place(null, { left: 0, top: 0 });
    expect(p.el.classList.contains('ring')).toBe(false);
    expect(p.el.classList.contains('placed')).toBe(false);
    const css = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
    expect(css).toMatch(/\.arcade-breath\.ring \.ab-text\{display:none\}/);
  });
});
