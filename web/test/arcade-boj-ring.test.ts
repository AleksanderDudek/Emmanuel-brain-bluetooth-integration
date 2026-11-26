/**
 * Dobry bój's ring (builder B): the layout at every kit/mobile CHECK_SIZES entry (the options in the thumb zone, inside
 * the insets, under the HUD, clear of each other; the bars, the why line, the coach and the breath's pacer clear of
 * each other), the rig's poses complete and sane for every moves.ts id and every view.ts Act (strikes reach their
 * targets, defences move the body off the line), the sound's cues safe before start() and after destroy() (and on a
 * recording context: throttled, budgeted, the world sinking in the slow motion), and the ring drawing every phase at
 * every size with no text under 13 px.
 */
import { describe, expect, it } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_READ, MIN_TAP, auditTargets, target } from '../src/arcade/kit/mobile';
import { CUE_GAP, RING_CUES, RingSound, chargeHz, worldCutoff, type RingCue } from '../src/arcade/boj/audio';
import { OPTION_H, fighterScale, layout } from '../src/arcade/boj/layout';
import { DEFENSE_IDS, OPENINGS, STRIKES, STRIKE_IDS, type Style } from '../src/arcade/boj/moves';
import { drawPreview } from '../src/arcade/boj/preview';
import { RingView } from '../src/arcade/boj/render';
import {
  BUILD, DEFENSE_SHAPES, GUARD, OPEN_SHAPES, POSE_KEYS, Rig, STRIKE_SHAPES, aimAt, allActs, poseFor, solve, strikeTip, travelT,
  type Joints,
} from '../src/arcade/boj/rig';
import type { Act, FightView, Look, Option, Phase } from '../src/arcade/boj/view';

type R = { x: number; y: number; w: number; h: number };
const overlap = (a: R, b: R): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const pacerRect = (p: { x: number; y: number; ring?: boolean }, big: boolean): R => (p.ring ? { x: p.x - 33, y: p.y, w: 66, h: 66 } : big ? { x: p.x - 120, y: p.y, w: 240, h: 80 } : { x: p.x - 105, y: p.y, w: 210, h: 70 });

describe('Dobry bój layout', () => {
  for (const z of CHECK_SIZES) {
    for (const touch of [true, false]) {
      it(`${z.name} (${touch ? 'touch' : 'mouse'})`, () => {
        const l = layout(z.w, z.h, z.insets, touch);
        const ins = z.insets;
        expect(l.options).toHaveLength(3);
        for (const o of l.options) {
          expect(o.h).toBeGreaterThanOrEqual(OPTION_H);
          expect(Math.min(o.w, o.h)).toBeGreaterThanOrEqual(MIN_TAP);
          expect(o.y).toBeGreaterThanOrEqual(ins.top);
        }
        expect(auditTargets(l.options.map((o, i) => target(`option ${i + 1}`, o)), z.w, z.h, ins)).toEqual([]);
        // an upright phone keeps the options in the thumb zone
        if (touch && z.h > z.w) for (const o of l.options) expect(o.y).toBeGreaterThan(z.h * 0.55);
        // the bars under the HUD, inside the sides, clear of the options
        for (const b of [l.bars.player, l.bars.foe]) {
          expect(b.y).toBeGreaterThanOrEqual(ins.top);
          expect(b.x).toBeGreaterThanOrEqual(ins.left);
          expect(b.x + b.w).toBeLessThanOrEqual(z.w - ins.right + 0.5);
          for (const o of l.options) expect(overlap(b, o)).toBe(0);
        }
        expect(overlap(l.bars.player, l.bars.foe)).toBe(0);
        // the why line clear of the options; the coach and the pacer clear of the bars and of each other
        for (const o of l.options) expect(overlap(l.why, o)).toBe(0);
        const big = (l.k ?? 1) >= 1.35;
        const pill = pacerRect(l.pacer!, big);
        expect(pill.y).toBeGreaterThanOrEqual(ins.top);
        expect(pill.x).toBeGreaterThanOrEqual(0);
        expect(pill.x + pill.w).toBeLessThanOrEqual(z.w + 0.5);
        expect(pill.y + pill.h).toBeLessThanOrEqual(z.h - ins.bottom + 0.5);
        expect(overlap(pill, l.coach)).toBe(0);
        for (const b of [l.bars.player, l.bars.foe]) {
          expect(overlap(pill, b)).toBe(0);
          expect(overlap(l.coach, b)).toBe(0);
        }
        expect(l.coach.y + l.coach.h).toBeLessThanOrEqual(z.h - ins.bottom + 0.5);
        expect(l.coach.x).toBeGreaterThanOrEqual(ins.left);
        // the fighters have room, the text is readable
        expect(fighterScale(l.stage!)).toBeGreaterThanOrEqual(z.w < 700 ? 150 : 200);
        expect(l.font).toBeGreaterThanOrEqual(MIN_READ);
        expect(l.stage!.y).toBeGreaterThanOrEqual(ins.top);
        if (l.card) expect(l.card.y).toBeGreaterThanOrEqual(ins.top);
      });
    }
  }
});

const STYLES: Style[] = ['boks', 'mma'];
const finite = (j: Joints): boolean => Object.values(j).every(v => (Array.isArray(v) ? v.every(Number.isFinite) : Number.isFinite(v as number)));

describe('Dobry bój rig', () => {
  it('has a shape for every strike, defence and opening of moves.ts', () => {
    expect(Object.keys(STRIKE_SHAPES).sort()).toEqual([...STRIKE_IDS].sort());
    expect(Object.keys(DEFENSE_SHAPES).sort()).toEqual([...DEFENSE_IDS].sort());
    for (const o of OPENINGS) expect(OPEN_SHAPES[o.tell]).toBeTypeOf('function');
    expect(Object.keys(GUARD).sort()).toEqual([...STYLES].sort());
  });

  it('draws every act of view.ts', () => {
    const kinds = new Set(allActs('mma').concat(allActs('boks')).map(a => a.act.kind));
    for (const k of ['guard', 'tell', 'open', 'strike', 'defend', 'hit', 'down', 'rise', 'out', 'corner', 'cheer', 'embrace', 'touch'] as const) expect(kinds.has(k)).toBe(true);
  });

  it('gives finite, standing poses for every act, at every moment and distance', () => {
    const acts: Act[] = [
      { kind: 'guard' }, { kind: 'down' }, { kind: 'rise' }, { kind: 'out' }, { kind: 'corner' }, { kind: 'cheer' }, { kind: 'embrace' }, { kind: 'touch' },
      ...STRIKE_IDS.flatMap(s => [{ kind: 'tell', strike: s } as Act, { kind: 'strike', strike: s, power: 0 } as Act, { kind: 'strike', strike: s, power: 1 } as Act]),
      ...DEFENSE_IDS.flatMap(d => [{ kind: 'defend', defense: d, ok: 0 } as Act, { kind: 'defend', defense: d, ok: 1 } as Act]),
      ...(['head', 'body', 'legs'] as const).map(t => ({ kind: 'hit', target: t, force: 1 }) as Act),
      ...OPENINGS.map(o => ({ kind: 'open', tell: o.tell }) as Act),
    ];
    for (const style of STYLES) {
      for (const sex of ['on', 'ona'] as const) {
        for (const act of acts) {
          for (const D of [0.32, 0.62, 0.86]) {
            for (let i = 0; i <= 10; i++) {
              const p = poseFor(act, i / 10, { style, D, time: i * 0.37, vs: i % 2 ? 'body' : 'head', breath: i / 10, walk: { phase: i, amt: i % 3 ? 0 : 1 } });
              for (const k of POSE_KEYS) expect(Number.isFinite(p[k]), `${act.kind} ${k}`).toBe(true);
              const j = solve(p, BUILD[sex]);
              expect(finite(j), `${JSON.stringify(act)} t=${i / 10}`).toBe(true);
              // nothing goes through the floor; the head stays up
              expect(Math.min(j.aL[1], j.aR[1])).toBeGreaterThan(0.015);
              expect(Math.min(j.gL[1], j.gR[1])).toBeGreaterThan(0.02);
              expect(j.head[1]).toBeGreaterThan(0.3);
            }
          }
        }
      }
    }
  });

  it('lands each strike where it aims at the moment of contact (the boxer’s numbers and the kicks)', () => {
    for (const style of STYLES) {
      for (const id of STRIKE_IDS) {
        if (!STRIKES[id].styles.includes(style)) continue;
        const D = 0.62;
        const j = solve(poseFor({ kind: 'strike', strike: id, power: 1 }, travelT(id, 1) - 1e-6, { style, D, time: 0 }), BUILD.on);
        const tip = strikeTip(j, id);
        if (id === 'takedown') {
          // the shot: the level low, the arms round the legs at the opponent's thighs
          expect(j.head[1]).toBeLessThan(0.6);
          expect(Math.max(j.gL[0], j.gR[0])).toBeGreaterThan(D - 0.35);
          continue;
        }
        if (id === 'knee') {
          expect(tip[1]).toBeGreaterThan(0.38);
          expect(tip[0]).toBeGreaterThan(0.2);
          continue;
        }
        const [ax, ay] = aimAt(STRIKES[id].target, D);
        // uppercuts land under the chin, the hooks and the kicks at the side: a tolerance, but at the target
        expect(Math.hypot(tip[0] - ax, tip[1] - ay), id).toBeLessThan(0.13);
      }
    }
  });

  it('moves the body off the line in a defence', () => {
    const c = { style: 'boks' as Style, D: 0.62, time: 0 };
    const g = solve(poseFor({ kind: 'guard' }, 0, c), BUILD.on);
    const at = (d: (typeof DEFENSE_IDS)[number], t = 0.5) => solve(poseFor({ kind: 'defend', defense: d, ok: 1 }, t, c), BUILD.on);
    const slip = at('slip');
    expect(Math.hypot(slip.head[0] - g.head[0], slip.head[1] - g.head[1], slip.head[2] - g.head[2])).toBeGreaterThan(0.08);
    expect(at('roll', 0.4).head[1]).toBeLessThan(g.head[1] - 0.12);
    expect(at('step').root).toBeLessThan(-0.1);
    const mma = { ...c, style: 'mma' as Style };
    expect(solve(poseFor({ kind: 'defend', defense: 'sprawl', ok: 1 }, 0.5, mma), BUILD.on).pel[1]).toBeLessThan(0.3);
    expect(solve(poseFor({ kind: 'defend', defense: 'check', ok: 1 }, 0.5, mma), BUILD.on).aL[1]).toBeGreaterThan(0.15);
    // a knockdown: a knee and a glove on the canvas
    const down = solve(poseFor({ kind: 'down' }, 1, c), BUILD.on);
    expect(down.kR[1]).toBeLessThan(0.08);
    expect(Math.min(down.gL[1], down.gR[1])).toBeLessThan(0.12);
  });

  it('blends between acts instead of jumping', () => {
    const r = new Rig(BUILD.on, 'boks');
    const c = { style: 'boks' as Style, D: 0.62, time: 0 };
    r.set({ kind: 'guard' }, 0, c);
    const before = r.joints.gR[0];
    const full = solve(poseFor({ kind: 'strike', strike: 'cross', power: 1 }, travelT('cross', 1), c), BUILD.on).gR[0];
    r.update({ kind: 'strike', strike: 'cross', power: 1 }, travelT('cross', 1), 1 / 60, c);
    const k = (r.joints.gR[0] - before) / (full - before);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(0.3);
    for (let i = 0; i < 12; i++) r.update({ kind: 'strike', strike: 'cross', power: 1 }, travelT('cross', 1), 1 / 60, c);
    expect(r.joints.gR[0]).toBeCloseTo(full, 3);
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
const st = (o: Partial<{ phase: Phase; slow: number; crowd: number; energy: number; breath: number }> = {}) => ({ phase: 'read' as Phase, slow: 0, crowd: 0.4, energy: 0, breath: 0.5, ...o });

describe('Dobry bój sound', () => {
  it('is safe before start(), after destroy() and with the sound off', () => {
    for (const on of [true, false]) {
      const { a } = fakeAudio(on);
      const s = new RingSound(a, { reducedMotion: false });
      for (const c of RING_CUES) s.cue(c, 1);
      s.update(1 / 60, st());
      s.pause(true);
      s.pause(false);
      s.start();
      for (const c of RING_CUES) s.cue(c, 0.5);
      s.update(1 / 60, st({ phase: 'slow', slow: 1, energy: 0.5 }));
      s.finish();
      s.destroy();
      for (const c of RING_CUES) s.cue(c, 1);
      s.update(1 / 60, st());
      s.pause(true);
      s.finish();
      s.destroy();
      expect(s.debug.on).toBe(on);
    }
    // a broken audio object never throws either
    const s = new RingSound(null as unknown as ArcadeAudio, { reducedMotion: true });
    s.start();
    s.cue('bell');
    s.update(0.1, st());
    s.destroy();
  });

  it('knows every cue of the contract', () => {
    const all: Record<RingCue, true> = {
      bell: true, touch: true, jab: true, punch: true, body: true, kick: true, blocked: true, slip: true, whoosh: true, takedown: true,
      slowIn: true, slowOut: true, ready: true, release: true, down: true, count: true, rise: true, ko: true, win: true, lose: true, crowd: true,
    };
    expect([...RING_CUES].sort()).toEqual(Object.keys(all).sort());
    expect(Object.keys(CUE_GAP).sort()).toEqual(Object.keys(all).sort());
  });

  it('rises from silence, throttles and budgets its cues, sinks the world in the slow motion, fades at the finish', () => {
    const { a, ctx, out } = fakeAudio();
    const s = new RingSound(a, { reducedMotion: false });
    s.start();
    const bus = ctx.gains.find(g => g.outs.includes(out))!;
    expect(bus).toBeTruthy();
    expect(bus.gain.value).toBe(0);
    expect(bus.gain.last).toBeGreaterThan(0);
    // every new source starts at or after now and is stopped
    const n0 = ctx.sources.length;
    s.cue('punch', 1);
    const n1 = ctx.sources.length;
    expect(n1).toBeGreaterThan(n0);
    for (const src of ctx.sources.slice(n0)) {
      expect(src.startAt).toBeGreaterThanOrEqual(0);
      expect(src.stopAt).toBeLessThan(Infinity);
    }
    s.cue('punch', 1);
    expect(ctx.sources.length).toBe(n1);
    ctx.currentTime += CUE_GAP.punch + 0.01;
    s.cue('punch', 1);
    expect(ctx.sources.length).toBeGreaterThan(n1);
    // the budget: a burst of many different cues is capped
    ctx.currentTime += 5;
    const before = ctx.sources.length;
    let played = 0;
    for (const c of RING_CUES) { const k = ctx.sources.length; s.cue(c); if (ctx.sources.length > k) played++; }
    expect(played).toBeLessThanOrEqual(10);
    expect(ctx.sources.length).toBeGreaterThan(before);
    // the slow motion closes the world's low-pass
    ctx.currentTime += 5;
    for (let i = 0; i < 40; i++) { ctx.currentTime += 1 / 30; s.update(1 / 30, st({ phase: 'slow', slow: 1, energy: 0.6 })); }
    const lows = ctx.filters.filter(f => f.type === 'lowpass').map(f => f.frequency.last);
    expect(Math.min(...lows)).toBeLessThan(1200);
    expect(worldCutoff(0)).toBeGreaterThan(12000);
    expect(worldCutoff(1)).toBeLessThan(800);
    expect(chargeHz(1) / chargeHz(0)).toBeCloseTo(1.4983, 3);
    // a pause schedules nothing
    s.pause(true);
    const p0 = ctx.sources.length;
    ctx.currentTime += 3;
    s.cue('bell');
    s.update(0.1, st({ phase: 'slow', slow: 1 }));
    expect(ctx.sources.length).toBe(p0);
    s.pause(false);
    s.finish();
    expect(bus.gain.last).toBe(0);
    s.destroy();
  });
});

// ── the picture ───────────────────────────────────────────────────

interface Drawn { text: string; px: number; x: number; y: number }
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
function fakeCtx(): { ctx: CanvasRenderingContext2D; texts: Drawn[] } {
  const texts: Drawn[] = [];
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
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
      return () => undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const LOOK: Look = { sex: 'ona', skin: 3, hair: 1, kit: '#2c5aa0', gloves: '#c0342f' };
const FOE: Look = { sex: 'ona', skin: 0, hair: 2, kit: '#a8443a', gloves: '#f0c040' };
const OPTS: Option[] = [
  { id: 'a', kind: 'counter', label: 'Unik + kontra', sub: 'z lewym podbródkowym', chosen: true, hint: false },
  { id: 'd', kind: 'counter', label: 'Ausweichen + Konter', sub: 'mit linkem Aufwärtshaken', chosen: false, hint: false },
  { id: 'b', kind: 'defense', label: 'Blok goleniem', sub: 'kopnięcie pod ramię', chosen: false, hint: true },
  { id: 'c', kind: 'attack', label: '1-2 + obalenie', sub: 'lewy, prawy i obalenie', chosen: false, hint: false },
];
function view(phase: Phase, style: Style, extra: Partial<FightView> = {}): FightView {
  const strike = style === 'mma' ? 'bodyKick' : 'hookR';
  return {
    style, phase, timeScale: phase === 'slow' ? 0.05 : 1, slow: phase === 'slow' ? 1 : 0,
    player: { look: LOOK, act: { kind: 'guard' }, t: 0.5, dur: 1, hp: 0.4, lives: 2, maxLives: 3, name: 'Ty' },
    foe: { look: FOE, act: phase === 'slow' ? { kind: 'strike', strike, power: 1 } : { kind: 'guard' }, t: 0.4, dur: 1, hp: 0.8, lives: 3, maxLives: 3, name: 'Mistrzyni' },
    round: 2, rounds: 3, energy: 0.6, ready: false, left: phase === 'slow' ? 12 : null,
    incoming: phase === 'slow' ? { strike, travel: 0.5 } : null,
    options: phase === 'slow' ? [OPTS[0], OPTS[3], OPTS[1]] : [], impacts: [{ on: 'foe', target: 'head', force: 0.8, text: 'Kontra!', age: 0.3 }, { on: 'player', target: 'body', force: 0.2, text: '−4', age: 0.6 }],
    count: phase === 'count' ? 7 : null, banner: phase === 'end' ? { text: 'DO KOŃCA NA NOGACH', age: 1 } : null,
    coach: phase === 'read' || phase === 'corner' ? 'Oddychaj. Ręce wysoko, łokcie przy sobie — jeszcze chwila.' : null,
    why: phase === 'slow' ? 'Pod hakiem przechodzi się rolką — kolana miękko, głowa pod łukiem.' : null,
    crowd: 0.6, breath: 0.5, reduced: false, ...extra,
  };
}

describe('Dobry bój picture', () => {
  it('draws every phase at every size with no text under 13 px', () => {
    const phases: Phase[] = ['intro', 'read', 'sequence', 'slow', 'resolve', 'corner', 'count', 'end'];
    for (const z of CHECK_SIZES) {
      for (const style of STYLES) {
        const l = layout(z.w, z.h, z.insets, z.w < 900);
        for (const reduced of [false, true]) {
          const rv = new RingView({ reduced });
          rv.resize(l, 2);
          for (const ph of phases) {
            const { ctx, texts } = fakeCtx();
            for (let i = 0; i < 4; i++) rv.draw(ctx, view(ph, style, { reduced }), 1 / 30, i / 30);
            for (const t of texts) {
              expect(t.px, `${z.name} ${ph} "${t.text}"`).toBeGreaterThanOrEqual(MIN_READ);
            }
            if (ph === 'slow') {
              expect(texts.some(t => t.text.startsWith('Unik'))).toBe(true);
              // the longest labels (a counter in de/sv) are never cut: they wrap
              expect(texts.filter(t => t.text.includes("…")).map(t => `${z.name}: ${t.text}`)).toEqual([]);
            }
          }
        }
      }
    }
  });

  it('draws the lobby hero and the card at any size, with or without a look', () => {
    for (const [w, h] of [[340, 190], [390, 260], [520, 760], [1, 1], [0, 0]] as const) {
      for (const style of [undefined, 'boks', 'mma'] as const) {
        const { ctx } = fakeCtx();
        expect(() => drawPreview(ctx, w, h, 2.5, w > 400 ? LOOK : undefined, style)).not.toThrow();
      }
    }
  });
});
