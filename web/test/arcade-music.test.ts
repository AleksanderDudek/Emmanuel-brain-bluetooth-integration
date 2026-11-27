import { describe, expect, it } from 'vitest';
import { MusicDirector, type MusicNow, type PlayerState, type TrackPlayer } from '../src/arcade/kit/music';
import {
  CLOSE_FADE, FADE, MIN_SESSION, TAIL_MAX, ageRecent, introOf, mmss, parseLength, planMusic, type MusicPlan, type Track,
} from '../src/arcade/kit/playlist';
import { appleTouch, isVideoId, parseVideoId } from '../src/arcade/kit/youtube';

/** The founder's eleven (round 17), with their lengths. */
const ELEVEN: Track[] = [
  ['Pclv31cDTTc', 439], ['fpT5X6HhK3g', 586], ['UvGGetm6pZ4', 237], ['-y-5Nba_Nz4', 239], ['qD3P7RULGIY', 190],
  ['1WgHGd5qfCM', 207], ['KGiwGcmBv1Q', 718], ['SSpH8Hsx8Q0', 224], ['TM3ENUzUCaA', 436], ['kYivP3gedCo', 588], ['c1XCS0g6J4A', 781],
].map(([id, sec]) => ({ id: id as string, sec: sec as number }));

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

const LENGTHS = [3, 5, 10, 15, 20, 25, 30, 45, 60];

/** The plan's shape: back to back, only the last may run past the end (by more than a minute played), else a short ambient close. */
function checkShape(p: MusicPlan, total: number, name: string): void {
  expect(p.empty, name).toBeNull();
  expect(p.slots.length, name).toBeGreaterThan(0);
  expect(p.intro, name).toBe(introOf(total));
  expect(p.intro).toBeGreaterThanOrEqual(8);
  expect(p.intro).toBeLessThanOrEqual(20);
  expect(p.slots[0].at, name).toBe(p.intro);
  for (let k = 1; k < p.slots.length; k++) {
    const prev = p.slots[k - 1];
    // the next begins FADE seconds before the one before ends: a cross-fade, never a gap of ambient
    expect(Math.abs(p.slots[k].at - (prev.at + prev.sec - FADE)), name).toBeLessThanOrEqual(1);
    expect(prev.at + prev.sec, `${name}: only the last may run past the end`).toBeLessThanOrEqual(total + 1);
    expect(prev.play, name).toBe(prev.sec);
  }
  const last = p.slots[p.slots.length - 1];
  expect(total - last.at, `${name}: the last begins with more than a minute left`).toBeGreaterThan(TAIL_MAX - 1);
  if (last.at + last.sec > total) {
    expect(p.cut, name).toBeGreaterThan(0);
    expect(p.tail, name).toBe(0);
    expect(Math.abs(last.play - (total - last.at)), name).toBeLessThanOrEqual(1);
  } else {
    expect(p.cut, name).toBe(0);
    expect(p.tail, name).toBeLessThanOrEqual(TAIL_MAX);
  }
}

describe('kit/playlist planMusic: tracks back to back, filling the session (round 24)', () => {
  for (const min of LENGTHS) {
    it(`${min} min: back to back with a cross-fade, the last one fits the end or fades under the close`, () => {
      const total = min * 60;
      for (let seed = 1; seed <= 25; seed++) {
        const p = planMusic({ total, tracks: ELEVEN, rng: seeded(seed) });
        checkShape(p, total, `${min} min seed ${seed}`);
        // the eleven are longer than an hour together: none comes twice
        expect(new Set(p.slots.map(s => s.id)).size).toBe(p.slots.length);
        if (min === 3) { expect(p.slots).toHaveLength(1); expect(p.cut).toBeGreaterThan(0); }
      }
    });
  }

  it('fills the session with songs: ≥ 80 % at 5 min, ≥ 92 % from 10 min (60 daily sessions with the rotation)', () => {
    for (const min of LENGTHS) {
      const total = min * 60;
      let recent = {}, share = 0;
      const rng = seeded(min);
      for (let day = 0; day < 60; day++) {
        const p = planMusic({ total, tracks: ELEVEN, rng, recent });
        share += p.music / total;
        recent = ageRecent(recent, p.slots.map(s => s.id));
      }
      expect(share / 60, `${min} min`).toBeGreaterThanOrEqual(min <= 5 ? 0.8 : 0.92);
    }
  });

  it('fits the end closely: a last track loses little, an ambient close is short', () => {
    for (const min of [10, 15, 20, 30, 45, 60]) {
      let cut = 0, tail = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const p = planMusic({ total: min * 60, tracks: ELEVEN, rng: seeded(seed) });
        cut += p.cut;
        tail += p.tail;
      }
      expect(cut / 40, `${min} min: seconds of the last track lost, on average`).toBeLessThan(75);
      expect(tail / 40, `${min} min: ambient at the end, on average`).toBeLessThan(40);
    }
  });

  it('draws different sets on different days (random), the same for the same seed', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) sets.add(planMusic({ total: 900, tracks: ELEVEN, rng: seeded(seed) }).slots.map(s => s.id).join(','));
    expect(sets.size).toBeGreaterThan(5);
    const a = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(3) });
    const b = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(3) });
    expect(a).toEqual(b);
  });

  it('rotates: a track heard last session comes back far less often', () => {
    for (const total of [180, 600]) {
      let withIt = 0, without = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const ids = planMusic({ total, tracks: ELEVEN, rng: seeded(seed), recent: { qD3P7RULGIY: 1 } }).slots.map(s => s.id);
        if (ids.includes('qD3P7RULGIY')) withIt++;
        const fresh = planMusic({ total, tracks: ELEVEN, rng: seeded(seed) }).slots.map(s => s.id);
        if (fresh.includes('qD3P7RULGIY')) without++;
      }
      expect(withIt, `${total} s`).toBeLessThan(without * 0.6);
    }
  });

  it('with the rotation, every track gets its turn within a few weeks of daily sessions (the short ones in 3–5 minutes)', () => {
    for (const min of LENGTHS) {
      for (const start of [1, 50]) {
        const seen = new Set<string>();
        let recent = {};
        const rng = seeded(start);
        // (at 15 min Ong Namo, 13:01, leaves 1:44 that only a chant faded early fills: its turn comes about every
        // six weeks — the plan prefers a close fit)
        for (let day = 0; day < (min === 15 ? 75 : 30); day++) {
          const ids = planMusic({ total: min * 60, tracks: ELEVEN, rng, recent }).slots.map(s => s.id);
          ids.forEach(id => seen.add(id));
          recent = ageRecent(recent, ids);
        }
        // every track that fits the session whole (in 3–5 minutes: those of about four minutes; a long one would be mostly cut)
        for (const t of ELEVEN) if (t.sec <= Math.max(240, min * 60 - introOf(min * 60))) expect(seen.has(t.id), `${min} min from ${start}: ${t.id}`).toBe(true);
      }
    }
  });

  it('a few allowed tracks come round again to fill an hour — never the same twice in a row while there are two', () => {
    const two = planMusic({ total: 3600, tracks: [{ id: 'a', sec: 237 }, { id: 'b', sec: 190 }], rng: seeded(3) });
    checkShape(two, 3600, 'two tracks');
    expect(two.slots.length).toBeGreaterThan(14);
    for (let k = 1; k < two.slots.length; k++) expect(two.slots[k].id).not.toBe(two.slots[k - 1].id);
    const one = planMusic({ total: 2700, tracks: [{ id: 'a', sec: 781 }], rng: seeded(3) });
    checkShape(one, 2700, 'one track');
    expect(one.slots.map(s => s.id)).toEqual(['a', 'a', 'a', 'a']);
    expect(one.music / 2700).toBeGreaterThan(0.95);
  });

  it('a track longer than the session plays from its start and fades under the close', () => {
    const p = planMusic({ total: 600, tracks: [{ id: 'long', sec: 7200 }], rng: seeded(1) });
    expect(p.slots).toEqual([{ id: 'long', sec: 7200, at: introOf(600), play: 600 - introOf(600) }]);
    expect(p.cut).toBe(7200 - (600 - introOf(600)));
  });

  it('says why there is no music: none allowed, or a test of a minute', () => {
    expect(planMusic({ total: 900, tracks: [], rng: seeded(1) }).empty).toBe('none');
    expect(planMusic({ total: 40, tracks: ELEVEN, rng: seeded(1) }).empty).toBe('short');
    expect(planMusic({ total: MIN_SESSION, tracks: ELEVEN, rng: seeded(1) }).empty).toBeNull();
    expect(MIN_SESSION).toBeLessThanOrEqual(180);   // every session the lobby offers holds a track
  });

  it('plans in a moment, even an hour of short tracks', () => {
    const t0 = performance.now();
    planMusic({ total: 3600, tracks: [{ id: 'a', sec: 30 }, { id: 'b', sec: 40 }, { id: 'c', sec: 25 }], rng: seeded(2) });
    for (let i = 0; i < 10; i++) planMusic({ total: 3600, tracks: ELEVEN, rng: seeded(i) });
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('ageRecent keeps three sessions of memory', () => {
    let r = ageRecent({}, ['a', 'b']);
    expect(r).toEqual({ a: 1, b: 1 });
    r = ageRecent(r, ['c']);
    expect(r).toEqual({ a: 2, b: 2, c: 1 });
    r = ageRecent(ageRecent(r, []), []);
    expect(r).toEqual({ c: 3 });
  });

  it('reads track lengths the way people type them', () => {
    expect(parseLength('7:19')).toBe(439);
    expect(parseLength(' 13.01 ')).toBe(781);
    expect(parseLength('439')).toBe(439);
    expect(parseLength('4m 39s')).toBe(279);
    expect(parseLength('5 min')).toBe(300);
    expect(parseLength('4:75')).toBeNull();
    expect(parseLength('abc')).toBeNull();
    expect(parseLength('5')).toBeNull();
    expect(mmss(439)).toBe('7:19');
    expect(mmss(59.6)).toBe('1:00');
  });
});

describe('kit/youtube appleTouch', () => {
  it('knows an iPhone, an iPad (also iPadOS calling itself a Mac with a touch screen) — not a Mac, not Android', () => {
    const ua = (s: string, touch = 5) => ({ userAgent: s, maxTouchPoints: touch });
    expect(appleTouch(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15'))).toBe(true);
    expect(appleTouch(ua('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'))).toBe(true);
    expect(appleTouch(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'))).toBe(true);
    expect(appleTouch(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 0))).toBe(false);
    expect(appleTouch(ua('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'))).toBe(false);
    expect(appleTouch(undefined)).toBe(false);
  });
});

describe('kit/youtube parseVideoId', () => {
  it('takes every common link form, and nothing else', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=Pclv31cDTTc')).toBe('Pclv31cDTTc');
    expect(parseVideoId('https://youtu.be/TM3ENUzUCaA?si=i9HVmW4zpMVaKmo8')).toBe('TM3ENUzUCaA');
    expect(parseVideoId('youtube.com/watch?v=-y-5Nba_Nz4&t=30s')).toBe('-y-5Nba_Nz4');
    expect(parseVideoId('https://m.youtube.com/watch?v=qD3P7RULGIY')).toBe('qD3P7RULGIY');
    expect(parseVideoId('https://music.youtube.com/watch?v=SSpH8Hsx8Q0&list=x')).toBe('SSpH8Hsx8Q0');
    expect(parseVideoId('https://www.youtube.com/shorts/kYivP3gedCo')).toBe('kYivP3gedCo');
    expect(parseVideoId('https://www.youtube-nocookie.com/embed/c1XCS0g6J4A')).toBe('c1XCS0g6J4A');
    expect(parseVideoId('KGiwGcmBv1Q')).toBe('KGiwGcmBv1Q');
    expect(parseVideoId('https://evil.example/watch?v=KGiwGcmBv1Q')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseVideoId('javascript:alert(1)')).toBeNull();
    expect(isVideoId('a"><img src')).toBe(false);
  });
});

/** A player that does what it is told, on the director's clock. */
class FakePlayer implements TrackPlayer {
  state: PlayerState = 'none';
  time = 0;
  duration = 0;
  error: number | null = null;
  blocked = false;
  volume = 100;
  loads: string[] = [];
  cues: string[] = [];
  lengths: Record<string, number> = {};
  /** the browser refuses to start without a tap */
  needsTap = false;
  failIds = new Set<string>();
  private open(id: string): void {
    this.time = 0;
    this.duration = this.lengths[id] ?? 0;
    this.error = this.failIds.has(id) ? 150 : null;
  }
  load(id: string): void {
    this.loads.push(id);
    this.open(id);
    this.state = this.needsTap ? 'unstarted' : 'buffering';
    this.blocked = this.needsTap;
  }
  cue(id: string): void {
    this.cues.push(id);
    this.open(id);
    this.state = 'cued';
  }
  play(): void {
    if (this.needsTap) { this.blocked = true; return; }
    if (this.state === 'cued') this.state = 'buffering';
    else if (this.state !== 'ended') this.state = 'playing';
  }
  pause(): void { if (this.state === 'playing' || this.state === 'buffering') this.state = 'paused'; }
  setVolume(v: number): void { this.volume = v; }
  /** the player's own time passes */
  tick(dt: number): void {
    if (this.state === 'buffering' && !this.error) this.state = 'playing';
    else if (this.state === 'playing') {
      this.time += dt;
      if (this.duration && this.time >= this.duration) { this.time = this.duration; this.state = 'ended'; }
    }
  }
  tap(): void { this.needsTap = false; this.blocked = false; this.state = 'playing'; }
}

interface Frame { t: number; now: MusicNow; playing: boolean[]; vol: number[]; mix: number }

function run(total: number, tracks: Track[], decks: FakePlayer[] | null, opts: {
  until?: number; fades?: boolean; overlap?: boolean; seed?: number; each?: (t: number, d: MusicDirector) => void;
} = {}) {
  for (const p of decks ?? []) for (const t of tracks) p.lengths[t.id] = t.sec;
  const plan = planMusic({ total, tracks, rng: seeded(opts.seed ?? 11) });
  let mix = 1;
  const mixes: number[] = [];
  const d = new MusicDirector(plan, decks, { mix: l => { mix = l; mixes.push(l); } }, { total, volume: 0.6, fades: opts.fades, overlap: () => opts.overlap ?? false });
  const dt = 0.25;
  const until = opts.until ?? total;
  const frames: Frame[] = [];
  for (let t = 0; t <= until; t += dt) {
    for (const p of decks ?? []) p.tick(dt);
    d.update(t);
    frames.push({ t, now: d.now, playing: (decks ?? []).map(p => p.state === 'playing'), vol: (decks ?? []).map(p => p.volume), mix });
    opts.each?.(t, d);
  }
  return { plan, d, mixes, frames };
}

/** Seconds during which two players play at once, per stretch. */
function overlaps(frames: Frame[]): number[] {
  const out: number[] = [];
  let run0 = 0;
  for (const f of frames) {
    if (f.playing.filter(Boolean).length > 1) run0 += 0.25;
    else if (run0) { out.push(run0); run0 = 0; }
  }
  if (run0) out.push(run0);
  return out;
}

/** Seconds during which no player plays, between the first track's start and the last's end. */
function gaps(frames: Frame[]): number[] {
  const first = frames.findIndex(f => f.playing.some(Boolean));
  let last = frames.length - 1;
  while (last > 0 && !frames[last].playing.some(Boolean)) last--;
  const out: number[] = [];
  let g = 0;
  for (let i = first; i <= last; i++) {
    if (!frames[i].playing.some(Boolean)) g += 0.25;
    else if (g) { out.push(g); g = 0; }
  }
  return out;
}

describe('kit/music MusicDirector', () => {
  it('two players, one place (a phone): fade-through — never two playing at once, the next starts as the one before ends', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    const { plan, d, frames, mixes } = run(1800, ELEVEN, decks, { overlap: false });
    expect(plan.slots.length).toBeGreaterThan(2);
    expect(overlaps(frames)).toEqual([]);
    // the next was cued in the other player while this one played: it starts at once (no ambient bridge of seconds)
    for (const g of gaps(frames)) expect(g).toBeLessThanOrEqual(1);
    expect(decks[0].loads.length + decks[1].loads.length).toBe(1);
    expect(decks[1].cues.length).toBeGreaterThan(0);
    expect([...decks[0].cues, ...decks[1].cues].length).toBe(plan.slots.length - 1);
    expect(d.played.sort()).toEqual([...new Set(plan.slots.map(s => s.id))].sort());
    // each change of track: the ending one falls to silence while the ambient swells softly (the bridge), then it falls again
    expect(mixes.filter(m => m === 0.75).length).toBeGreaterThanOrEqual(plan.slots.length - 1);
    // the ending track's last seconds fall gently: half way down 2.5 s before its end
    const ends = frames.filter((f, i) => i > 0 && frames[i - 1].now.deck !== f.now.deck);
    expect(ends.length).toBe(plan.slots.length - 1);
    for (const e of ends) {
      const before = frames.find(f => Math.abs(f.t - (e.t - 2.5)) < 0.01)!;
      const old = 1 - e.now.deck;
      expect(before.vol[old]).toBeGreaterThan(10);
      expect(before.vol[old]).toBeLessThan(45);
    }
    expect(Math.max(...frames.flatMap(f => f.vol.filter((_, i) => f.playing[i])))).toBeLessThanOrEqual(60);   // never above the app's volume
  });

  it('two players and room for two cards (a large desk): a cross-fade of about FADE seconds, one rising while the other falls', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    const { plan, frames } = run(1800, ELEVEN, decks, { overlap: true });
    const o = overlaps(frames);
    expect(o.length).toBe(plan.slots.length - 1);
    for (const s of o) { expect(s).toBeGreaterThanOrEqual(FADE - 1.5); expect(s).toBeLessThanOrEqual(FADE + 1); }
    // during a cross-fade both cards show: the next one in the second place
    const both = frames.filter(f => f.playing[0] && f.playing[1]);
    expect(both.every(f => f.now.next !== null && f.now.next.deck !== f.now.deck)).toBe(true);
    // in each cross-fade the rising one grows, the falling one shrinks
    const stretches: Frame[][] = [];
    frames.forEach((f, i) => {
      if (!(f.playing[0] && f.playing[1])) return;
      if (i > 0 && frames[i - 1].playing[0] && frames[i - 1].playing[1]) stretches[stretches.length - 1].push(f);
      else stretches.push([f]);
    });
    for (const st of stretches) {
      const first = st[0], lastF = st[st.length - 1];
      const inc = first.now.next!.deck, out = first.now.deck;
      expect(lastF.now.next?.deck ?? inc).toBe(inc);
      expect(lastF.vol[inc]).toBeGreaterThan(first.vol[inc] + 20);
      expect(lastF.vol[out]).toBeLessThan(first.vol[out] - 20);
    }
    // and the ambient is silent under two tracks
    expect(both.every(f => f.mix === 0)).toBe(true);
  });

  it('an iPhone (one player, no volume): the next loads into the same player, the ambient swells over each change', () => {
    const p = new FakePlayer();
    const { plan, mixes, frames } = run(1800, ELEVEN, [p], { fades: false });
    expect(p.loads).toEqual(plan.slots.map(s => s.id));
    expect(p.cues).toEqual([]);
    expect(mixes.filter(m => m === 0.75).length).toBeGreaterThanOrEqual(plan.slots.length - 1);
    for (const g of gaps(frames)) expect(g).toBeLessThanOrEqual(1);
  });

  it('the last track that runs past the end fades out under the close, and stops with it', () => {
    for (const overlap of [false, true]) {
      const decks = [new FakePlayer(), new FakePlayer()];
      // a 10-minute session of the eleven always ends in a track faded under the close
      const { plan, frames, d } = run(600, ELEVEN, decks, { overlap });
      expect(plan.cut).toBeGreaterThan(0);
      const closing = frames.filter(f => f.now.phase === 'closing');
      expect(closing.length * 0.25).toBeGreaterThanOrEqual(CLOSE_FADE - 1);
      expect(closing[0].t).toBeGreaterThanOrEqual(600 - CLOSE_FADE - 0.5);
      const deck = closing[0].now.deck;
      const v = closing.map(f => f.vol[deck]);
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1]);
      expect(v[v.length - 1]).toBeLessThan(10);
      const end = frames[frames.length - 1];
      expect(end.playing.some(Boolean)).toBe(false);
      expect(d.now.phase).toBe('done');
      expect(d.canStop()).toBe(true);
    }
  });

  it('never runs a track into the summary: a late, slow track fades out before the end', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    // the players' clocks run at half speed (buffering): the plan's times slip
    for (const p of decks) { const slow = p.tick.bind(p); p.tick = (dt: number) => slow(dt / 2); }
    let lastPhase = '';
    run(600, ELEVEN, decks, { each: (t, dd) => { if (t >= 599.9) lastPhase = dd.now.phase; } });
    expect(['done', 'ambient']).toContain(lastPhase);
    expect(decks.some(p => p.state === 'playing')).toBe(false);
  });

  it('skips a track that cannot play (blocked embed) and carries on — the cued next takes its turn', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    const plan = planMusic({ total: 1200, tracks: ELEVEN, rng: seeded(11) });
    for (const p of decks) p.failIds.add(plan.slots[1].id);
    const { d } = run(1200, ELEVEN, decks);
    expect(d.skipped).toContain(plan.slots[1].id);
    expect(d.played).toContain(plan.slots[0].id);
    expect(d.played).toContain(plan.slots[2].id);
  });

  it('asks for one tap when the browser wants it, then plays on in that player (the second would ask again)', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    for (const p of decks) p.needsTap = true;
    let asked = 0;
    const { d, plan } = run(1200, ELEVEN, decks, {
      each: (_t, dd) => { if (dd.now.tap) { asked++; if (asked === 20) decks[0].tap(); } },
    });
    expect(asked).toBe(20);
    expect(decks[1].loads.length + decks[1].cues.length).toBe(0);
    expect(decks[0].loads.length).toBe(plan.slots.length);
    expect(d.played.length).toBeGreaterThan(1);
  });

  it('a second player that wants a tap of its own: the tracks go on in the first one, without asking', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    decks[1].needsTap = true;
    let asked = false;
    const { d, plan } = run(1200, ELEVEN, decks, { each: (_t, dd) => { if (dd.now.tap) asked = true; } });
    expect(asked).toBe(false);
    expect(d.played.length).toBe(new Set(plan.slots.map(s => s.id)).size);
    expect(decks[0].loads.length).toBe(plan.slots.length);
  });

  it('without a tap: asks once, then the ambient alone for the rest of the session', () => {
    const decks = [new FakePlayer(), new FakePlayer()];
    for (const p of decks) p.needsTap = true;
    const { d } = run(1200, ELEVEN, decks);
    expect(decks[0].loads.length).toBe(1);
    expect(decks[1].loads.length + decks[1].cues.length).toBe(0);
    expect(d.played).toEqual([]);
    expect(d.now.phase).toBe('done');
  });

  it('pauses the tracks with the session and resumes them after', () => {
    const p = new FakePlayer();
    p.lengths = Object.fromEntries(ELEVEN.map(t => [t.id, t.sec]));
    const plan = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(11) });
    const d = new MusicDirector(plan, [p, new FakePlayer()], { mix: () => undefined }, { total: 900, volume: 1 });
    let t = 0;
    while (d.now.phase !== 'track' && t < 300) { p.tick(0.25); d.update(t); t += 0.25; }
    expect(d.now.phase).toBe('track');
    d.pause(true);
    expect(p.state).toBe('paused');
    d.pause(false);
    expect(p.state).toBe('playing');
  });

  it('after a session pause the player\'s moment of "paused" is not taken for a pause by hand (no ambient swell)', () => {
    const p = new FakePlayer();
    p.lengths = Object.fromEntries(ELEVEN.map(t => [t.id, t.sec]));
    const plan = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(11) });
    const mixes: number[] = [];
    const d = new MusicDirector(plan, p, { mix: l => mixes.push(l) }, { total: 900, volume: 1 });
    let t = 0;
    while (d.now.phase !== 'track' && t < 300) { p.tick(0.25); d.update(t); t += 0.25; }
    for (let k = 0; k < 20; k++) { p.tick(0.25); d.update(t); t += 0.25; }
    d.pause(true);
    // the real player takes a moment to start again: it still says "paused"
    p.play = () => undefined;
    d.pause(false);
    const before = mixes.length;
    for (let k = 0; k < 4; k++) { p.tick(0.25); d.update(t); t += 0.25; }
    p.state = 'playing';
    for (let k = 0; k < 8; k++) { p.tick(0.25); d.update(t); t += 0.25; }
    expect(mixes.slice(before)).not.toContain(0.7);
    expect(d.now.phase).toBe('track');
  });

  it('a slow handshake is not a browser that wants a tap: the start wait counts from the player\'s answer', () => {
    const p = new FakePlayer() as FakePlayer & { ready: boolean };
    p.ready = false;
    const load = p.load.bind(p);
    let loadedAt = -1;
    let t = 0;
    p.load = (id: string) => { load(id); p.state = 'unstarted'; p.ready = false; loadedAt = t; };
    p.lengths = Object.fromEntries(ELEVEN.map(x => [x.id, x.sec]));
    const plan = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(11) });
    const d = new MusicDirector(plan, p, { mix: () => undefined }, { total: 900, volume: 1 });
    let asked = false;
    for (; t < 400; t += 0.25) {
      if (loadedAt >= 0 && !p.ready && t - loadedAt >= 15) { p.ready = true; p.state = 'buffering'; }
      p.tick(0.25);
      d.update(t);
      if (d.now.tap) asked = true;
    }
    expect(asked).toBe(false);
    expect(d.played.length).toBeGreaterThan(0);
  });

  it('with no player (offline, sound off) the ambient carries the whole session', () => {
    const plan = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(11) });
    const d = new MusicDirector(plan, null, { mix: () => undefined }, { total: 900, volume: 1 });
    for (let t = 0; t < 900; t += 1) d.update(t);
    expect(d.now.show).toBe(false);
    expect(d.played).toEqual([]);
  });

  it('an hour: every planned track plays, the players never both play outside a cross-fade, the session ends quiet', () => {
    for (const overlap of [false, true]) {
      const decks = [new FakePlayer(), new FakePlayer()];
      const { plan, d, frames } = run(3600, ELEVEN, decks, { overlap, seed: 5 });
      expect(plan.slots.length).toBeGreaterThanOrEqual(7);
      expect(d.played.length).toBe(plan.slots.length);
      const o = overlaps(frames);
      expect(o.length).toBe(overlap ? plan.slots.length - 1 : 0);
      const heard = frames.filter(f => f.playing.some(Boolean)).length * 0.25;
      expect(heard / 3600).toBeGreaterThan(0.93);
      expect(frames[frames.length - 1].playing.some(Boolean)).toBe(false);
    }
  });
});
