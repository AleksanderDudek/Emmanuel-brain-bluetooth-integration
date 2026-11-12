/**
 * The mobile-first kit (src/arcade/kit/mobile.ts): finger-sized hit areas, text that fits without
 * shrinking under the floor, and the target audit every game's layout test uses.
 */
import { describe, expect, it } from 'vitest';
import { CHECK_SIZES, MIN_TAP, MIN_TEXT, auditTargets, fitText, hitRect, hits, target, uiScale } from '../src/arcade/kit/mobile';

const SIZE = /(\d+(?:\.\d+)?)px/;
const sizeOf = (font: string): number => Number(font.match(SIZE)?.[1] ?? 10);

/** A canvas context that measures text as 0.6 em per character (enough to test fitting). */
function measuringContext(): CanvasRenderingContext2D {
  const ctx = {
    font: '10px sans-serif',
    measureText(text: string) {
      return { width: text.length * sizeOf(this.font) * 0.6 } as TextMetrics;
    },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('kit/mobile', () => {
  it('grows a small control to a finger-sized target around its centre', () => {
    const g = hitRect({ x: 100, y: 50, w: 20, h: 30 });
    expect(g.w).toBe(MIN_TAP);
    expect(g.h).toBe(MIN_TAP);
    expect(g.x + g.w / 2).toBe(110);
    expect(g.y + g.h / 2).toBe(65);
    // a big one stays as it is
    expect(hitRect({ x: 0, y: 0, w: 80, h: 60 })).toEqual({ x: 0, y: 0, w: 80, h: 60 });
    expect(hits({ x: 100, y: 50, w: 20, h: 30 }, 89, 45)).toBe(true);
    expect(hits({ x: 100, y: 50, w: 20, h: 30 }, 80, 45)).toBe(false);
    expect(target('ok', { x: 0, y: 0, w: 10, h: 10 }).w).toBe(MIN_TAP);
  });

  it('starts the UI scale from the phone and never goes under 1', () => {
    expect(uiScale(360, 500)).toBe(1);
    expect(uiScale(390, 564)).toBe(1);
    expect(uiScale(844, 390)).toBe(1);
    expect(uiScale(1280, 672)).toBeCloseTo(1.3);
    expect(uiScale(820, 1052, 1.2)).toBeCloseTo(1.2);
  });

  it('fits a label by shrinking to the floor, then cuts it with an ellipsis', () => {
    const ctx = measuringContext();
    // fits at the asked size
    expect(fitText(ctx, 'Łapa', 100, 14, 700, 'sans-serif')).toBe('Łapa');
    expect(ctx.font).toBe('700 14px sans-serif');
    // shrinks, but not under MIN_TEXT
    const long = 'Zwinne łapy kotów';
    const out = fitText(ctx, long, 120, 14, 700, 'sans-serif');
    expect(sizeOf(ctx.font)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(ctx.measureText(out).width).toBeLessThanOrEqual(120);
    if (out !== long) expect(out.endsWith('…')).toBe(true);
    // never asks for less than the floor, even when the caller does
    fitText(ctx, 'x', 100, 6, 700, 'sans-serif');
    expect(ctx.font).toBe(`700 ${MIN_TEXT}px sans-serif`);
  });

  it('audits targets: size, the safe play area, overlaps', () => {
    const ins = { top: 134, right: 0, bottom: 0, left: 0 };
    expect(auditTargets([{ label: 'a', x: 10, y: 400, w: 60, h: 48 }], 390, 564, ins)).toEqual([]);
    const bad = auditTargets([
      { label: 'small', x: 10, y: 400, w: 30, h: 48 },
      { label: 'under the HUD', x: 100, y: 100, w: 60, h: 60 },
      { label: 'off the edge', x: 360, y: 500, w: 60, h: 60 },
      { label: 'twin', x: 12, y: 404, w: 30, h: 48 },
    ], 390, 564, ins);
    expect(bad.some(p => p.includes('"small"') && p.includes('under 44'))).toBe(true);
    expect(bad.some(p => p.includes('"under the HUD"'))).toBe(true);
    expect(bad.some(p => p.includes('"off the edge"'))).toBe(true);
    expect(bad.some(p => p.includes('overlap'))).toBe(true);
  });

  it('checks the hardest phone first, and every size leaves room to play', () => {
    expect(CHECK_SIZES[0].w).toBe(360);
    for (const s of CHECK_SIZES) expect(s.h - s.insets.top - s.insets.bottom).toBeGreaterThan(250);
  });
});
