/**
 * Złota passa's street (builder B): the layout at every kit/mobile CHECK_SIZES entry (the choices for one to four
 * reframes in the thumb zone or beside the card, ≥ 44 px, inside the insets, under the HUD, clear of each other and of
 * the card; the breath pacer, the narrator and the free card clear of each other; the street's garland in sight above
 * the free card), every motif of moments.ts drawn on both sides, the garland's geometry, the sound's cues safe before
 * `start()` and after `destroy()` (and on a recording context: throttled, budgeted, the street thinning in a heavy
 * moment, fading at the finish), and the street drawing every phase at every size with no text under 13 px and no
 * choice label cut.
 */
import { describe, expect, it } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_READ, MIN_TAP, auditTargets, target } from '../src/arcade/kit/mobile';
import { CUE_GAP, LEVEL, STREET_CUES, StreetSound, bellHz, layersAt, type StreetCue } from '../src/arcade/passa/audio';
import { CardPainter } from '../src/arcade/passa/card';
import { Garland, SPANS, bulbAt, spansFor, targetBulb } from '../src/arcade/passa/garland';
import { CHOICE_H, cardFor, choiceRects, layout, type Layout } from '../src/arcade/passa/layout';
import { GARLAND_MAX, MOTIFS, type Motif } from '../src/arcade/passa/moments';
import { MOTIF_DRAW, drawFlame, drawMotif, goldPal, greyPal } from '../src/arcade/passa/motifs';
import { lightAt } from '../src/arcade/passa/paint';
import { drawPreview } from '../src/arcade/passa/preview';
import { StreetView } from '../src/arcade/passa/render';
import { project } from '../src/arcade/passa/scene';
import type { CardView, ChoiceView, PassaView, Phase } from '../src/arcade/passa/view';
import { PER_SPAN } from '../src/arcade/passa/world';

type R = { x: number; y: number; w: number; h: number };
const overlap = (a: R, b: R): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const pacerRect = (p: { x: number; y: number; ring?: boolean }, big: boolean): R => (p.ring ? { x: p.x - 36, y: p.y, w: 72, h: 72 } : big ? { x: p.x - 120, y: p.y, w: 240, h: 80 } : { x: p.x - 105, y: p.y, w: 210, h: 70 });

describe('Złota passa layout', () => {
  for (const z of CHECK_SIZES) {
    for (const touch of [true, false]) {
      it(`${z.name} (${touch ? 'touch' : 'mouse'})`, () => {
        const l = layout(z.w, z.h, z.insets, touch);
        const ins = z.insets;
        expect(l.choices).toHaveLength(4);
        expect(l.font).toBeGreaterThanOrEqual(MIN_READ);
        for (let n = 1; n <= 4; n++) {
          const rs = choiceRects(l, n);
          expect(rs).toHaveLength(n);
          for (const r of rs) {
            expect(r.h).toBeGreaterThanOrEqual(CHOICE_H);
            expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(MIN_TAP);
          }
          // inside the canvas and the insets, under the HUD, no two overlapping
          expect(auditTargets(rs.map((r, i) => target(`choice ${i + 1}`, r)), z.w, z.h, ins)).toEqual([]);
          // the card for n choices is clear of them and inside the band
          const c = cardFor(l, n);
          for (const r of rs) expect(overlap(c, r)).toBe(0);
          expect(c.y).toBeGreaterThanOrEqual(ins.top);
          expect(c.x).toBeGreaterThanOrEqual(ins.left);
          expect(c.x + c.w).toBeLessThanOrEqual(z.w - ins.right + 0.5);
          // an upright phone: the choices in the thumb zone (their middles in the lower half; three or fewer whole in the bottom 45 %)
          if (l.mode === 'upright' && touch) {
            for (const r of rs) expect(r.y + r.h / 2).toBeGreaterThan(z.h * 0.5);
            if (n <= 3) for (const r of rs) expect(r.y).toBeGreaterThan(z.h * 0.55);
          }
        }
        // the free card, the narrator's line and the breath pacer: inside the band and clear of each other
        const free = l.cardFree!;
        expect(free.y).toBeGreaterThanOrEqual(ins.top);
        expect(free.y + free.h).toBeLessThanOrEqual(z.h - ins.bottom + 0.5);
        const big = (l.k ?? 1) >= 1.35;
        const pill = pacerRect(l.pacer!, big);
        expect(pill.y).toBeGreaterThanOrEqual(ins.top);
        expect(pill.x).toBeGreaterThanOrEqual(ins.left - 0.5);
        expect(pill.x + pill.w).toBeLessThanOrEqual(z.w - ins.right + 0.5);
        expect(pill.y + pill.h).toBeLessThanOrEqual(z.h - ins.bottom + 0.5);
        expect(overlap(pill, free)).toBe(0);
        expect(overlap(pill, l.say)).toBe(0);
        expect(overlap(l.say, free)).toBe(0);
        expect(l.say.y + l.say.h).toBeLessThanOrEqual(z.h - ins.bottom + 0.5);
        expect(l.story.y).toBeGreaterThanOrEqual(ins.top);
        expect(l.banner.y).toBeGreaterThanOrEqual(ins.top);
        // the card is large enough to read
        expect(l.card.h).toBeGreaterThanOrEqual(96);
        expect(l.card.w).toBeGreaterThanOrEqual(260);
        // the street's camera, and the garland's first span in sight over the free card, under the HUD
        const cam = l.street!;
        expect(cam.f).toBeGreaterThan(100);
        expect(cam.hy).toBeGreaterThan(ins.top);
        expect(cam.hy).toBeLessThanOrEqual(free.y + 1);
        const seen = Array.from({ length: PER_SPAN }, (_, i) => {
          const b = bulbAt(i);
          const [x, y] = project(cam, b.x, b.y, b.z);
          return x > 0 && x < z.w && y > ins.top && y < free.y;
        }).filter(Boolean).length;
        expect(seen, 'first span bulbs in sight').toBeGreaterThanOrEqual(PER_SPAN / 2);
      });
    }
  }
});

// ── the picture's parts ───────────────────────────────────────────

interface Drawn { text: string; px: number; x: number; y: number }
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
function fakeCtx(): { ctx: CanvasRenderingContext2D; texts: Drawn[]; calls: { n: number } } {
  const texts: Drawn[] = [];
  const calls = { n: 0 };
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalCompositeOperation: 'source-over' };
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * pxOf(String(target.font)) * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown, x: number, y: number) => {
        const text = String(s);
        if (text.trim() && (target.globalAlpha as number) > 0.05) texts.push({ text, px: pxOf(String(target.font)), x, y });
      };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'fill' || prop === 'stroke' || prop === 'fillRect') return () => { calls.n++; };
      return () => undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, calls };
}

describe('Złota passa motifs and garland', () => {
  it('draws every motif of moments.ts on the grey side, the heavy grey and the gold side', () => {
    expect(Object.keys(MOTIF_DRAW).sort()).toEqual([...MOTIFS].sort());
    for (const m of MOTIFS) {
      for (const pal of [greyPal(false), greyPal(true), goldPal(m, false), goldPal(m, true)]) {
        for (const t of [0, 1.7]) {
          const { ctx, calls } = fakeCtx();
          expect(() => drawMotif(ctx, m, 4, 4, 100, pal, t)).not.toThrow();
          expect(calls.n, m).toBeGreaterThan(2);
        }
      }
    }
    const { ctx, calls } = fakeCtx();
    drawFlame(ctx, 0, 0, 80, 1.2);
    expect(calls.n).toBeGreaterThan(2);
    // an unknown motif falls back (never throws)
    expect(() => drawMotif(fakeCtx().ctx, 'nothing' as Motif, 0, 0, 50, greyPal(false))).not.toThrow();
  });

  it('strings the garland across the street, near first, and doubles up past GARLAND_MAX', () => {
    expect(SPANS * PER_SPAN).toBe(GARLAND_MAX);
    for (let i = 0; i < GARLAND_MAX * 2; i++) {
      const b = bulbAt(i, Math.sin(i));
      for (const v of [b.x, b.y, b.z]) expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(b.x)).toBeLessThanOrEqual(5);
      expect(b.y).toBeGreaterThan(3.5);
      expect(b.z).toBeGreaterThan(7);
    }
    // the spans are deeper down the street one after another
    expect(bulbAt(PER_SPAN * 2).z).toBeGreaterThan(bulbAt(0).z);
    expect(spansFor(0, null)).toBe(1);
    expect(spansFor(PER_SPAN - 1, null)).toBe(1);
    expect(spansFor(PER_SPAN - 1, 0.5)).toBe(2);
    expect(spansFor(PER_SPAN, null)).toBe(2);
    expect(spansFor(999, null)).toBe(SPANS);
    expect(targetBulb(3)).toBe(3);
    expect(targetBulb(GARLAND_MAX + 2)).toBe(2);
    const g = new Garland();
    const cam = { cx: 200, hy: 300, f: 300 };
    for (const lights of [0, 3, 12, 40, 55]) {
      const { ctx } = fakeCtx();
      expect(() => g.draw(ctx, cam, { lights, flying: 0.5, time: lights, reduced: false, calm: 0.5, dusk: 0.8, breath: 0.5, from: { x: 200, y: 450 }, k: 1 })).not.toThrow();
      expect(() => g.flight(ctx, cam, { lights, flying: 0.5, time: lights, reduced: true, calm: 0, dusk: 0, breath: 0.5, from: { x: 200, y: 450 }, k: 1 })).not.toThrow();
    }
  });

  it('follows the day from the dawn to the night', () => {
    const dawn = lightAt(0), noon = lightAt(0.46), night = lightAt(1);
    expect(dawn.lamps).toBeGreaterThan(0.5);
    expect(noon.lamps).toBe(0);
    expect(noon.sunI).toBeGreaterThan(0.9);
    expect(night.sunI).toBe(0);
    expect(night.stars).toBe(1);
    expect(noon.L[1]).toBeGreaterThan(0.8);
    // the sun behind the viewer in the morning, ahead in the afternoon
    expect(lightAt(0.2).L[2]).toBeLessThan(0);
    expect(lightAt(0.7).L[2]).toBeGreaterThan(0);
  });
});

// ── the sound ─────────────────────────────────────────────────────

type Ev = [string, ...number[]];
class FParam {
  events: Ev[] = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { if (!(v > 0)) throw new RangeError('exponential ramp to ≤ 0'); this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number, tau: number) { if (!(tau > 0) || !Number.isFinite(v)) throw new RangeError('target'); this.events.push(['target', v, t, tau]); return this; }
  cancelScheduledValues(t: number) { this.events.push(['cancel', t]); return this; }
  get last(): number { const e = [...this.events].reverse().find(x => x[0] === 'target' || x[0] === 'lin' || x[0] === 'set'); return e ? e[1] : this.value; }
}
class FNode {
  outs: unknown[] = [];
  constructor(readonly kind: string) {}
  connect<T>(d: T): T { this.outs.push(d); return d; }
  disconnect(): void { this.outs = []; }
}
class FSource extends FNode {
  startAt = -1;
  stopAt = Infinity;
  onended: (() => void) | null = null;
  frequency = new FParam(440);
  detune = new FParam(0);
  playbackRate = new FParam(1);
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  start(t = 0) { if (this.startAt >= 0) throw new Error('started twice'); this.startAt = t; }
  stop(t = 0) { this.stopAt = Math.min(this.stopAt, t); }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FNode('destination');
  gains: (FNode & { gain: FParam })[] = [];
  filters: (FNode & { type: string; frequency: FParam; Q: FParam })[] = [];
  sources: FSource[] = [];
  createGain() { const n = Object.assign(new FNode('gain'), { gain: new FParam(1) }); this.gains.push(n); return n; }
  createOscillator() { const o = new FSource('osc'); this.sources.push(o); return o; }
  createBufferSource() { const o = new FSource('buffer'); this.sources.push(o); return o; }
  createBiquadFilter() { const f = Object.assign(new FNode('filter'), { type: 'lowpass', frequency: new FParam(350), Q: new FParam(1) }); this.filters.push(f); return f; }
  createConvolver() { return Object.assign(new FNode('convolver'), { buffer: null as unknown, normalize: true }); }
  createStereoPanner() { return Object.assign(new FNode('panner'), { pan: new FParam(0) }); }
  createBuffer(ch: number, len: number, sr: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: (i: number) => data[i] };
  }
}
function fakeAudio(on = true) {
  const ctx = new FakeCtx();
  const out = ctx.createGain();
  const a = { ctx: on ? ctx : null, out: on ? out : null, on, level: on ? 0.6 : 0 };
  return { a: a as unknown as ArcadeAudio, ctx, out };
}
const st = (o: Partial<{ phase: Phase; day: number; glow: number; breath: number }> = {}) => ({ phase: 'turn' as Phase, day: 0.2, glow: 0.4, breath: 0.5, ...o });

describe('Złota passa sound', () => {
  it('is safe before start(), after destroy(), with the sound off and with a broken audio', () => {
    for (const on of [true, false]) {
      const { a } = fakeAudio(on);
      const s = new StreetSound(a, { reducedMotion: false });
      for (const c of STREET_CUES) s.cue(c, 1);
      s.update(1 / 60, st());
      s.pause(true);
      s.pause(false);
      s.start();
      for (const c of STREET_CUES) s.cue(c, 3);
      s.update(1 / 60, st({ phase: 'evening', day: 0.95 }));
      s.finish();
      s.destroy();
      for (const c of STREET_CUES) s.cue(c, 1);
      s.update(1 / 60, st());
      s.pause(true);
      s.finish();
      s.destroy();
      expect(s.debug.on).toBe(on);
    }
    const s = new StreetSound(null as unknown as ArcadeAudio, { reducedMotion: true });
    s.start();
    s.cue('light', 2);
    s.update(0.1, st());
    s.destroy();
  });

  it('knows every cue of the contract and climbs the scale with the streak', () => {
    const all: Record<StreetCue, true> = { arrive: true, turnStart: true, turned: true, light: true, carry: true, trust: true, heavy: true, evening: true, dawn: true };
    expect([...STREET_CUES].sort()).toEqual(Object.keys(all).sort());
    expect(Object.keys(CUE_GAP).sort()).toEqual(Object.keys(all).sort());
    for (let n = 1; n < 9; n++) expect(bellHz(n + 1)).toBeGreaterThan(bellHz(n));
    // an octave and a half, then round again
    expect(bellHz(9) / bellHz(1)).toBeGreaterThan(2.9);
    expect(bellHz(9) / bellHz(1)).toBeLessThan(3.1);
    expect(bellHz(10)).toBeCloseTo(bellHz(1), 6);
    expect(bellHz(0)).toBeCloseTo(bellHz(1), 6);
    // the street through the day: birds and the café in the morning, the fountain in the afternoon, crickets at night
    expect(layersAt(0.05).birds).toBeGreaterThan(0.9);
    expect(layersAt(0.95).birds).toBe(0);
    expect(layersAt(0.95).crickets).toBeGreaterThan(0.9);
    expect(layersAt(0.2).crickets).toBe(0);
    expect(layersAt(0.65).fountain).toBeGreaterThan(0.9);
    expect(layersAt(0.5).hum).toBeGreaterThan(0.9);
  });

  it('rises from silence, throttles and budgets its cues, thins out in a heavy moment, fades at the finish', () => {
    const { a, ctx, out } = fakeAudio();
    const s = new StreetSound(a, { reducedMotion: false });
    s.start();
    const bus = ctx.gains.find(g => g.outs.includes(out))!;
    expect(bus).toBeTruthy();
    expect(bus.gain.value).toBe(0);
    expect(bus.gain.last).toBe(LEVEL);
    // every new source starts at or after now and is stopped
    const n0 = ctx.sources.length;
    s.cue('light', 1);
    const n1 = ctx.sources.length;
    expect(n1).toBeGreaterThan(n0);
    for (const src of ctx.sources.slice(n0)) {
      expect(src.startAt).toBeGreaterThanOrEqual(0);
      expect(src.stopAt).toBeLessThan(Infinity);
    }
    s.cue('light', 2);
    expect(ctx.sources.length).toBe(n1);
    ctx.currentTime += CUE_GAP.light + 0.01;
    s.cue('light', 2);
    expect(ctx.sources.length).toBeGreaterThan(n1);
    // the budget: a burst of every cue is capped
    ctx.currentTime += 10;
    let played = 0;
    for (const c of STREET_CUES) { const k = ctx.sources.length; s.cue(c, 1); if (ctx.sources.length > k) played++; }
    expect(played).toBeLessThanOrEqual(6);
    // a heavy moment: the street's sound thins out while it is named and turned
    ctx.currentTime += 10;
    s.cue('heavy');
    for (let i = 0; i < 120; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, st({ phase: 'name', day: 0.3 })); }
    expect(s.debug.thin).toBeGreaterThan(0.8);
    ctx.currentTime += 3;
    s.cue('arrive');
    for (let i = 0; i < 200; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, st({ phase: 'turn', day: 0.3 })); }
    expect(s.debug.thin).toBeLessThan(0.1);
    // birds in the morning are scheduled by update alone
    const b0 = ctx.sources.length;
    for (let i = 0; i < 300; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, st({ phase: 'savor', day: 0.05 })); }
    expect(ctx.sources.length).toBeGreaterThan(b0);
    // a pause schedules nothing
    s.pause(true);
    const p0 = ctx.sources.length;
    ctx.currentTime += 5;
    s.cue('evening', 3);
    for (let i = 0; i < 60; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, st({ day: 0.05 })); }
    expect(ctx.sources.length).toBe(p0);
    s.pause(false);
    s.finish();
    expect(bus.gain.last).toBe(0);
    s.destroy();
  });
});

// ── the picture ───────────────────────────────────────────────────

const CHOICES: ChoiceView[] = [
  { id: 'a', label: 'Więcej kroków — dla zdrowia', chosen: true, trust: false },
  { id: 'b', label: 'Eine Gelegenheit, unterwegs ein paar Minuten in Ruhe zu beten', chosen: false, trust: false },
  { id: 'c', label: 'En stund att andas och låta dagen sakta ner lite grann', chosen: false, trust: false },
  { id: 't', label: 'Jeszcze tego nie widzę — ufam', chosen: false, trust: true },
];
const CARD: CardView = { kind: 'snag', motif: 'car', what: 'Jedyne wolne miejsce — na samym końcu parkingu, daleko od drzwi', win: 'Więcej kroków — dla zdrowia', turn: 0.4, write: 0.3, near: 1, own: true };

function view(phase: Phase, extra: Partial<PassaView> = {}): PassaView {
  const card = phase === 'intro' || phase === 'evening' || phase === 'end' ? null
    : { ...CARD, near: phase === 'arrive' ? 0.4 : phase === 'carry' ? 0.5 : 1, turn: phase === 'savor' ? 1 : phase === 'turn' ? 0.6 : 0, write: phase === 'savor' ? 1 : 0.4, kind: phase === 'name' ? 'heavy' as const : 'snag' as const };
  return {
    phase, day: phase === 'evening' ? 0.97 : 0.4, part: 'noon', card, choices: phase === 'turn' || phase === 'arrive' ? CHOICES : [],
    lights: 7, flying: phase === 'savor' ? 0.5 : null, days: 5, glow: 0.6, say: 'Dobro jest wszędzie, gdy się patrzy — i ten parking też się liczy.',
    banner: phase === 'evening' ? 'Jestem na złotej passie — wszystko współdziała ku dobremu' : null, breath: 0.5, carried: 2, reduced: false,
    sign: 'Dzień passy: 5', ...extra,
  };
}

describe('Złota passa picture', () => {
  it('draws every phase at every size with no text under 13 px and no choice label cut', () => {
    const phases: Phase[] = ['intro', 'arrive', 'name', 'turn', 'savor', 'carry', 'evening', 'end'];
    for (const z of CHECK_SIZES) {
      const l: Layout = layout(z.w, z.h, z.insets, z.w < 900);
      for (const reduced of [false, true]) {
        const sv = new StreetView({ reduced });
        sv.resize(l, 2);
        for (const ph of phases) {
          const { ctx, texts } = fakeCtx();
          for (let i = 0; i < 40; i++) sv.draw(ctx, view(ph, { reduced }), 1 / 20, i / 20);
          for (const t of texts) expect(t.px, `${z.name} ${ph} "${t.text}"`).toBeGreaterThanOrEqual(MIN_READ);
          expect(texts.filter(t => t.text.includes('…')).map(t => `${z.name}: ${t.text}`)).toEqual([]);
          if (ph === 'turn') expect(texts.some(t => t.text.startsWith('Więcej'))).toBe(true);
          if (ph === 'evening') expect(texts.some(t => t.text.includes('złotej passie'))).toBe(true);
        }
      }
    }
  });

  it('draws a card at any turn, size and kind without throwing', () => {
    const cp = new CardPainter();
    for (const kind of ['joy', 'snag', 'heavy'] as const) {
      for (const turn of [0, 0.25, 0.5, 0.75, 1]) {
        for (const [w, h] of [[336, 116], [470, 244], [10, 6]] as const) {
          const { ctx } = fakeCtx();
          expect(() => cp.draw(ctx, { ...CARD, kind, turn, trust: kind === 'heavy', glow: 0.7 }, 200, 200, w, h, 1, { time: 1, reduced: false, font: 15, k: 1 })).not.toThrow();
        }
      }
    }
  });

  it('draws the lobby hero and the card at any size', () => {
    for (const [w, h] of [[340, 190], [390, 260], [520, 760], [1, 1], [0, 0]] as const) {
      for (const lights of [0, 12, 40, 90]) {
        const { ctx } = fakeCtx();
        expect(() => drawPreview(ctx, w, h, 2.5, lights, lights > 20 ? 7 : 0)).not.toThrow();
      }
    }
  });
});
