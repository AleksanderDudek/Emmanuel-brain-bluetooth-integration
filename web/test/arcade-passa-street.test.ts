/**
 * Złota passa's street (builder B): the layout at every kit/mobile CHECK_SIZES entry (the choices for one to four
 * reframes in the thumb zone or beside the card, ≥ 44 px, inside the insets, under the HUD, clear of each other and of
 * the card; the breath pacer, the narrator and the free card clear of each other; the street's garland in sight above
 * the free card), every motif of moments.ts drawn on both sides, the garland's geometry, the sound's cues safe before
 * `start()` and after `destroy()` (and on a recording context: throttled, budgeted, the street thinning in a heavy
 * moment, fading at the finish), and the street drawing every phase at every size with no text under 13 px and no
 * choice label cut.
 *
 * Round 25 (§29, the film — P2): every place of the day painted at every size and hour (and the street), each place's
 * things where the camera can find them, every motif's thing for a close-up, the camera (a cut on a new place and its
 * dissolve, the layers always covering the canvas, no move with reduced motion), a sense moment's close-up and a given
 * moment's greying from `life`, the guide line as a subtitle over the card (≥ 13 px, never cut), the garland in sight
 * in every place, and each place's sound (its beds crossfading, a given moment's hush and its bloom).
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
import { CUT_REDUCED_S, CUT_S, FilmCamera, layerXf } from '../src/arcade/passa/camera';
import { LIFE_MOTIFS, PLACES, type LifeView, type Place } from '../src/arcade/passa/life';
import { PLACE_SETS, aimIn, setOf } from '../src/arcade/passa/places';
import { closeShot } from '../src/arcade/passa/render';
import { stageOf } from '../src/arcade/passa/stage';
import { SPOT_OBJECTS, THINGS, drawObject } from '../src/arcade/passa/things';
import { PLACE_MIX } from '../src/arcade/passa/audio';
import { roomAt } from '../src/arcade/passa/stage';

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

// ── round 25: the film of a day ───────────────────────────────────

const FILM_SIZES = CHECK_SIZES.filter(z => ['small phone (Chrome)', 'iPhone (installed app, chart off)', 'phone on its side (chart on)', 'desktop', '2560 × 1440 monitor (the middle column)'].includes(z.name));

describe('Złota passa film: the places of the day', () => {
  it('has a set for every place but the street, each with its things where the camera can find them', () => {
    for (const p of PLACES) {
      const set = PLACE_SETS[p];
      if (p === 'street') { expect(set).toBeUndefined(); continue; }
      expect(set, p).toBeTruthy();
      expect(set!.id).toBe(p);
      // its heart within a phone's view (x ±1.6), over the card (y ≤ 0.2), under the HUD's edge (y ≥ −3.3)
      expect(Math.abs(set!.aim[0]), `${p} aim`).toBeLessThanOrEqual(1.6);
      expect(set!.spot[1]).toBeLessThanOrEqual(0.2);
      expect(Math.abs(set!.spot[0])).toBeLessThanOrEqual(2);
      for (const [m, at] of Object.entries(set!.hot)) {
        expect(Math.abs(at![0]), `${p} ${m}`).toBeLessThanOrEqual(3.8);
        expect(at![1], `${p} ${m}`).toBeGreaterThanOrEqual(-3.4);
        expect(at![1], `${p} ${m}`).toBeLessThanOrEqual(0.8);
      }
      // every motif finds an aim (its own, the spot, the window, or the set's)
      for (const m of MOTIFS) {
        const a = aimIn(set!, m);
        expect(a.every(Number.isFinite), `${p} ${m}`).toBe(true);
      }
      if (set!.win) expect(set!.win[2]).toBeGreaterThan(set!.win[0]);
    }
    expect(setOf('street')).toBeNull();
    expect(setOf(undefined)).toBeNull();
  });

  it('paints every place at every hour on every kind of screen, with its live parts', () => {
    for (const z of FILM_SIZES) {
      const l = layout(z.w, z.h, z.insets, z.w < 900);
      const S = stageOf(l);
      expect(S.u).toBeGreaterThan(5);
      // the strip over the card is ~2.9 units: the place's heart stands in it
      expect(S.top).toBeLessThan(-1.5);
      for (const p of PLACES) {
        const set = PLACE_SETS[p];
        if (!set) continue;
        for (const day of [0.04, 0.3, 0.62, 0.95]) {
          const R = roomAt(day, set.face);
          const { ctx, calls } = fakeCtx();
          expect(() => { set.back(ctx, S, R); set.front(ctx, S, R); }, `${p} ${day}`).not.toThrow();
          expect(() => { set.beyond?.(ctx, S, R, 3.2, false); set.behind?.(ctx, S, R, 3.2, false); set.over?.(ctx, S, R, 3.2, false); }).not.toThrow();
          expect(calls.n, `${p} paints`).toBeGreaterThan(20);
        }
      }
    }
  });

  it('has a thing for every motif — a painting for a close-up, and real objects to set down in a place', () => {
    for (const m of new Set([...MOTIFS, ...LIFE_MOTIFS])) {
      const th = THINGS[m];
      expect(th, m).toBeTruthy();
      const R = roomAt(0.3);
      for (const t of [0, 2.1]) {
        const { ctx, calls } = fakeCtx();
        if (th.kind === 'object') { th.still(ctx, R); th.live?.(ctx, R, t, 0.7); } else { th.still(ctx, R, 0, 0, 390, 420); th.live?.(ctx, R, 0, 0, 390, 420, t, 0.7); }
        expect(calls.n, m).toBeGreaterThan(2);
      }
    }
    for (const m of SPOT_OBJECTS) {
      expect(THINGS[m].kind, m).toBe('object');
      expect(() => drawObject(fakeCtx().ctx, m, roomAt(0.5), 0, 0, 0.5, 1)).not.toThrow();
    }
  });
});

describe('Złota passa film: the camera', () => {
  const ask = (place: Place, o: Partial<{ push: number; lift: number }> = {}) => ({ place, aim: { x: 120, y: 300 }, push: o.push ?? 0, lift: o.lift ?? 0, w: 390, h: 844, M: 59, street: place === 'street' });

  it('cuts on a new place and dissolves from the last frame of the one before', () => {
    const cam = new FilmCamera(false);
    cam.update(1 / 60, ask('bedroom'));
    expect(cam.cutCount).toBe(0);
    for (let i = 0; i < 120; i++) cam.update(1 / 60, ask('bedroom'));
    cam.update(1 / 60, ask('kitchen'));
    expect(cam.cutCount).toBe(1);
    expect(cam.prev).toBe('bedroom');
    expect(cam.mix).toBeLessThan(0.1);
    for (let t = 0; t < CUT_S + 0.1; t += 1 / 60) cam.update(1 / 60, ask('kitchen'));
    expect(cam.mix).toBe(1);
    expect(cam.prev).toBeNull();
    // the same place again is no cut
    cam.update(1 / 60, ask('kitchen'));
    expect(cam.cutCount).toBe(1);
  });

  it('dollies slowly, pushes in on the thing, looks up after a win — and keeps every layer covering the canvas', () => {
    const cam = new FilmCamera(false);
    const seen = { minZ: 9, maxZ: 0, minPx: 9e9, maxPx: -9e9 };
    for (let i = 0; i < 60 * 50; i++) {
      const push = i > 60 * 30 ? Math.min(1, (i - 1800) / 600) : 0;
      const fr = cam.update(1 / 60, ask('office', { push, lift: i % 900 < 200 ? 1 : 0 }));
      seen.minZ = Math.min(seen.minZ, fr.z); seen.maxZ = Math.max(seen.maxZ, fr.z);
      seen.minPx = Math.min(seen.minPx, fr.px); seen.maxPx = Math.max(seen.maxPx, fr.px);
      for (const d of [0.35, 0.55, 1]) {
        const x = layerXf(fr, d, 390, 844, 59);
        // the layer (59 px larger on every side) covers the canvas
        expect(-59 * x.z + x.x).toBeLessThanOrEqual(0.01);
        expect((390 + 59) * x.z + x.x).toBeGreaterThanOrEqual(389.99);
        expect(-59 * x.z + x.y).toBeLessThanOrEqual(0.01);
        expect((844 + 59) * x.z + x.y).toBeGreaterThanOrEqual(843.99);
      }
    }
    expect(seen.minZ).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(seen.maxZ).toBeGreaterThan(1.3);
    expect(seen.maxPx - seen.minPx).toBeGreaterThan(40);
    // the street: a slow push along it, never under 1 (it has no overscan)
    const st = new FilmCamera(false);
    for (let i = 0; i < 600; i++) {
      const fr = st.update(1 / 60, ask('street', { push: 0.3 }));
      const x = layerXf(fr, 1, 390, 844, 0);
      expect(x.x).toBeLessThanOrEqual(0.01);
      expect(390 * x.z + x.x).toBeGreaterThanOrEqual(389.99);
    }
  });

  it('holds still with reduced motion (the cuts are fades)', () => {
    const cam = new FilmCamera(true);
    for (let i = 0; i < 600; i++) {
      const fr = cam.update(1 / 60, ask(i < 300 ? 'park' : 'garden', { push: 1, lift: 1 }));
      expect(fr.z).toBe(1);
      expect(fr.px).toBe(0);
      expect(fr.py).toBe(0);
    }
    expect(cam.cutCount).toBe(1);
    expect(CUT_REDUCED_S).toBeGreaterThan(CUT_S);
  });
});

describe('Złota passa film: sense and given moments', () => {
  const life = (o: Partial<LifeView>): LifeView => ({ place: 'kitchen', kind: 'sense', close: 0, sense: 'taste', guide: null, without: 0, ...o });

  it('frames a sense moment from its close: pushes in, the close-up dissolves in, focus opens it', () => {
    expect(closeShot(null).alpha).toBe(0);
    expect(closeShot(life({ close: 0 })).alpha).toBe(0);
    expect(closeShot(life({ close: 0.25 })).alpha).toBeGreaterThan(0.95);
    const a = closeShot(life({ close: 0.3 })), b = closeShot(life({ close: 0.7 })), c = closeShot(life({ close: 1 }));
    expect(a.open).toBeLessThan(b.open);
    expect(b.open).toBeLessThan(c.open);
    expect(c.open).toBeCloseTo(1, 5);
    expect(c.size).toBeCloseTo(1, 5);
    expect(c.push).toBeCloseTo(1, 5);
    expect(c.grey).toBe(0);
  });

  it('greys a given moment as it is imagined away, and brings its colour back with focus', () => {
    const g = (without: number, close = 0.3) => closeShot(life({ kind: 'given', sense: null, without, close }));
    expect(g(0).grey).toBe(0);
    expect(g(1).grey).toBe(1);
    expect(g(0.5).grey).toBeGreaterThan(0.3);
    expect(g(1).open).toBe(0);
    expect(g(0).open).toBe(1);
    // the close-up is there through the rest (P1: close 0.15–0.35)
    expect(g(0.6, 0.15).alpha).toBeGreaterThan(0.7);
  });

  it('draws a day of the film at every size: sense close-ups with their guide as a subtitle, given greying, every place', () => {
    const guide = 'Poczuj ciepło kubka w dłoniach — i pierwszy łyk, powoli, bez pośpiechu';
    for (const z of FILM_SIZES) {
      const l = layout(z.w, z.h, z.insets, z.w < 900);
      for (const reduced of [false, true]) {
        const sv = new StreetView({ reduced });
        sv.resize(l, 2);
        let n = 0;
        for (const p of PLACES) {
          const base = view('turn', { choices: [], place: p, reduced });
          const card = { ...base.card!, kind: 'sense' as const, motif: 'tea' as const };
          const warm = fakeCtx();
          const lf = life({ place: p, close: 0.6, guide });
          for (let i = 0; i < 6; i++) sv.draw(warm.ctx, { ...base, card, life: lf }, 1 / 20, n++ / 20);
          const { ctx, texts } = fakeCtx();
          sv.draw(ctx, { ...base, card, life: lf }, 1 / 20, n++ / 20);
          for (const t of texts) expect(t.px, `${z.name} ${p} "${t.text}"`).toBeGreaterThanOrEqual(MIN_READ);
          expect(texts.filter(t => t.text.includes('…'))).toEqual([]);
          // the subtitle: every word of the guide on the canvas, above the card
          const cap = texts.filter(t => guide.includes(t.text) && t.text.length > 3);
          expect(cap.map(t => t.text).join(' ').replace(/\s+/g, ' '), `${z.name} ${p}`).toBe(guide);
          const free = l.cardFree ?? l.card;
          for (const t of cap) expect(t.y, `${z.name} ${p} caption over the card`).toBeLessThan(free.y);
          // a given moment greying, then coming back
          const gv = { ...base, card: { ...card, kind: 'given' as const, motif: 'tap' as const } };
          const g2 = fakeCtx();
          for (const w of [0, 0.5, 1, 0.6, 0.2, 0]) sv.draw(g2.ctx, { ...gv, phase: w === 1 || w === 0.5 ? 'without' : 'turn', life: life({ place: p, kind: 'given', sense: null, close: 0.35, without: w, guide: w > 0.4 ? 'Wyobraź sobie ten poranek bez wody w kranie.' : null }) }, 1 / 20, n++ / 20);
        }
        expect(sv.film.cuts).toBeGreaterThanOrEqual(PLACES.length - 1);
      }
    }
  });

  it('keeps the garland in sight in every place, under the HUD and over the card', () => {
    for (const z of CHECK_SIZES) {
      const l = layout(z.w, z.h, z.insets, z.w < 900);
      const sv = new StreetView({ reduced: true });
      sv.resize(l, 1);
      const free = l.cardFree ?? l.card;
      for (const p of ['kitchen', 'street'] as const) {
        const cam = sv.garlandCam(p);
        const seen = Array.from({ length: PER_SPAN }, (_, i) => {
          const b = bulbAt(i);
          const [x, y] = project(cam, b.x, b.y, b.z);
          return x > 0 && x < z.w && y > z.insets.top && y < free.y;
        }).filter(Boolean).length;
        expect(seen, `${z.name} ${p}`).toBeGreaterThanOrEqual(PER_SPAN / 2);
      }
    }
  });
});

describe('Złota passa film: the places\' sound', () => {
  it('knows every place but the street (whose sound is round 22\'s)', () => {
    for (const p of PLACES) {
      if (p === 'street') expect((PLACE_MIX as Record<string, unknown>)[p]).toBeUndefined();
      else expect(PLACE_MIX[p as Exclude<Place, 'street'>], p).toBeTruthy();
    }
  });

  it('crossfades the beds as the film travels; a given moment hushes the place and blooms when it comes back', () => {
    const { a, ctx } = fakeAudio();
    const s = new StreetSound(a, { reducedMotion: false });
    s.start();
    const run = (sec: number, o: Partial<Parameters<StreetSound['update']>[1]>) => {
      for (let i = 0; i < sec * 30; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, { ...st({ phase: 'turn', day: 0.3 }), ...o }); }
    };
    run(2, { place: 'bus' });
    expect(s.debug.place).toBe('bus');
    const lastOf = (pred: (g: { gain: FParam }) => boolean) => ctx.gains.filter(pred).map(g => g.gain.last);
    const targets = () => ctx.gains.map(g => g.gain.last);
    const busLevels = targets();
    run(2, { place: 'garden' });
    const gardenLevels = targets();
    // something rose and something fell between the bus and the garden
    expect(gardenLevels.some((v, i) => v > busLevels[i] + 1e-4)).toBe(true);
    expect(gardenLevels.some((v, i) => v < busLevels[i] - 1e-4)).toBe(true);
    void lastOf;
    // the bedroom's clock ticks by itself
    const n0 = ctx.sources.length;
    run(5, { place: 'bedroom' });
    expect(ctx.sources.length).toBeGreaterThan(n0 + 3);
    // a given moment: its rest thins the place, its return blooms
    const given = (without: number): LifeView => ({ place: 'kitchen', kind: 'given', close: 0.35, sense: null, guide: null, without });
    run(3, { place: 'kitchen', phase: 'without', life: given(1) });
    expect(s.debug.thin).toBeGreaterThan(0.6);
    const n1 = ctx.sources.length;
    run(0.2, { place: 'kitchen', phase: 'turn', life: given(0) });
    expect(ctx.sources.length - n1).toBeGreaterThanOrEqual(4);
    run(4, { place: 'kitchen', phase: 'savor', life: null });
    expect(s.debug.thin).toBeLessThan(0.2);
    // a hearing moment's own sound comes forward (a song)
    const n2 = ctx.sources.length;
    run(3, { place: 'car', motif: 'music', life: { place: 'car', kind: 'sense', close: 0.8, sense: 'hearing', guide: null, without: 0 } });
    expect(ctx.sources.length).toBeGreaterThan(n2 + 3);
    s.finish();
    s.destroy();
  });
});
