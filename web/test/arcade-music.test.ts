import { describe, expect, it } from 'vitest';
import { CLOSE_MIN, MusicDirector, type PlayerState, type TrackPlayer } from '../src/arcade/kit/music';
import { ageRecent, frame, longestFit, mmss, parseLength, planMusic, type Track } from '../src/arcade/kit/playlist';
import { isVideoId, parseVideoId } from '../src/arcade/kit/youtube';

/** The founder's eleven (round 17), with their lengths. */
const ELEVEN: Track[] = [
  ['Pclv31cDTTc', 439], ['fpT5X6HhK3g', 586], ['UvGGetm6pZ4', 237], ['-y-5Nba_Nz4', 239], ['qD3P7RULGIY', 190],
  ['1WgHGd5qfCM', 207], ['KGiwGcmBv1Q', 718], ['SSpH8Hsx8Q0', 224], ['TM3ENUzUCaA', 436], ['kYivP3gedCo', 588], ['c1XCS0g6J4A', 781],
].map(([id, sec]) => ({ id: id as string, sec: sec as number }));

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe('kit/playlist planMusic', () => {
  for (const min of [3, 5, 10, 15, 20, 25, 30]) {
    it(`${min} min: tracks fit whole, with ambient before, between and after`, () => {
      const total = min * 60;
      for (let seed = 1; seed <= 25; seed++) {
        const p = planMusic({ total, tracks: ELEVEN, rng: seeded(seed) });
        const [i0, g0, o0] = frame(total);
        if (min === 3) { expect(p.empty).toBe('short'); expect(p.slots).toHaveLength(0); continue; }
        expect(p.empty).toBeNull();
        expect(p.slots.length).toBeGreaterThan(0);
        expect(p.intro).toBeGreaterThanOrEqual(i0);
        expect(p.slots[0].at).toBe(p.intro);
        for (let k = 1; k < p.slots.length; k++) {
          const prev = p.slots[k - 1];
          expect(p.slots[k].at - (prev.at + prev.sec)).toBeGreaterThanOrEqual(g0 - 1);
        }
        const last = p.slots[p.slots.length - 1];
        expect(total - (last.at + last.sec)).toBeGreaterThanOrEqual(o0 - 1);
        expect(new Set(p.slots.map(s => s.id)).size).toBe(p.slots.length);   // no track twice
      }
    });
  }

  it('fills a 30-minute session mostly with music', () => {
    const p = planMusic({ total: 1800, tracks: ELEVEN, rng: seeded(7) });
    expect(p.music).toBeGreaterThan(1800 * 0.7);
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
    let withIt = 0, without = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const ids = planMusic({ total: 600, tracks: ELEVEN, rng: seeded(seed), recent: { qD3P7RULGIY: 1 } }).slots.map(s => s.id);
      if (ids.includes('qD3P7RULGIY')) withIt++;
      const fresh = planMusic({ total: 600, tracks: ELEVEN, rng: seeded(seed) }).slots.map(s => s.id);
      if (fresh.includes('qD3P7RULGIY')) without++;
    }
    expect(withIt).toBeLessThan(without * 0.6);
  });

  it('with the rotation, every track that fits gets its turn within a few weeks of daily sessions', () => {
    for (const min of [5, 10, 15, 20, 30]) {
      for (const start of [1, 50]) {
        const seen = new Set<string>();
        let recent = {};
        const rng = seeded(start);
        for (let day = 0; day < 30; day++) {
          const ids = planMusic({ total: min * 60, tracks: ELEVEN, rng, recent }).slots.map(s => s.id);
          ids.forEach(id => seen.add(id));
          recent = ageRecent(recent, ids);
        }
        for (const t of ELEVEN) if (t.sec <= longestFit(min * 60)) expect(seen.has(t.id), `${min} min from ${start}: ${t.id}`).toBe(true);
      }
    }
  });

  it('says why there is no music', () => {
    expect(planMusic({ total: 900, tracks: [], rng: seeded(1) }).empty).toBe('none');
    expect(planMusic({ total: 300, tracks: [{ id: 'long', sec: 781 }], rng: seeded(1) }).empty).toBe('short');
    expect(longestFit(300)).toBeGreaterThanOrEqual(239);   // 5 min: the shorter chants fit
    expect(longestFit(180)).toBeLessThan(190);              // 3 min: none of the eleven
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
  lengths: Record<string, number> = {};
  /** the browser refuses to start without a tap */
  needsTap = false;
  failIds = new Set<string>();
  load(id: string): void {
    this.loads.push(id);
    this.time = 0;
    this.duration = this.lengths[id] ?? 0;
    this.error = this.failIds.has(id) ? 150 : null;
    this.state = this.needsTap ? 'unstarted' : 'buffering';
    this.blocked = this.needsTap;
  }
  play(): void { if (!this.needsTap && this.state !== 'ended') this.state = 'playing'; }
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

function run(total: number, tracks: Track[], player: FakePlayer, opts: { until?: number; each?: (t: number, d: MusicDirector) => void } = {}) {
  for (const t of tracks) player.lengths[t.id] = t.sec;
  const plan = planMusic({ total, tracks, rng: seeded(11) });
  const mixes: [number, number][] = [];
  const d = new MusicDirector(plan, player, { mix: l => mixes.push([l, 0]) }, { total, volume: 0.6 });
  const dt = 0.25;
  const until = opts.until ?? total;
  for (let t = 0; t <= until; t += dt) {
    player.tick(dt);
    d.update(t);
    opts.each?.(t, d);
  }
  return { plan, d, mixes };
}

describe('kit/music MusicDirector', () => {
  it('plays the planned tracks whole, in turn, with the ambient between, and ends with the ambient', () => {
    const p = new FakePlayer();
    let trackTime = 0;
    let atEnd = '';
    const { plan, d } = run(900, ELEVEN, p, {
      each: (t, dd) => { if (dd.now.phase === 'track') trackTime += 0.25; if (t > 900 - CLOSE_MIN) atEnd = dd.now.phase; },
    });
    expect(p.loads).toEqual(plan.slots.map(s => s.id));
    expect(d.played.sort()).toEqual(plan.slots.map(s => s.id).sort());
    expect(trackTime).toBeGreaterThan(plan.music - 10);
    expect(atEnd === 'done' || atEnd === 'ambient').toBe(true);
    expect(p.volume).toBeLessThanOrEqual(60);   // never above the app's volume
  });

  it('skips a track that cannot play (blocked embed) and carries on', () => {
    const p = new FakePlayer();
    const plan = planMusic({ total: 1200, tracks: ELEVEN, rng: seeded(11) });
    p.failIds.add(plan.slots[0].id);
    const { d } = run(1200, ELEVEN, p);
    expect(d.skipped).toContain(plan.slots[0].id);
    expect(d.played.length).toBeGreaterThan(0);
  });

  it('asks for one tap when the browser wants it, then plays on after the tap', () => {
    const p = new FakePlayer();
    p.needsTap = true;
    let asked = 0;
    const { d } = run(900, ELEVEN, p, {
      each: (_t, dd) => { if (dd.now.tap) { asked++; if (asked === 20) p.tap(); } },
    });
    expect(asked).toBeGreaterThanOrEqual(20);
    expect(d.played.length).toBeGreaterThan(0);
  });

  it('without a tap: asks once, then the ambient alone for the rest of the session', () => {
    const p = new FakePlayer();
    p.needsTap = true;
    const { d } = run(1200, ELEVEN, p);
    expect(p.loads.length).toBe(1);
    expect(d.played).toEqual([]);
    expect(d.now.phase).toBe('done');
  });

  it('never runs a track into the summary: a late, slow track fades out before the end', () => {
    const p = new FakePlayer();
    // the player's clock runs at half speed (buffering): the plan's times slip
    const slow = p.tick.bind(p);
    p.tick = (dt: number) => slow(dt / 2);
    let lastPhase = '';
    run(600, ELEVEN, p, { each: (t, dd) => { if (t >= 599) lastPhase = dd.now.phase; } });
    expect(['done', 'ambient']).toContain(lastPhase);
    expect(p.state === 'playing').toBe(false);
  });

  it('pauses the track with the session and resumes it after', () => {
    const p = new FakePlayer();
    p.lengths = Object.fromEntries(ELEVEN.map(t => [t.id, t.sec]));
    const plan = planMusic({ total: 900, tracks: ELEVEN, rng: seeded(11) });
    const d = new MusicDirector(plan, p, { mix: () => undefined }, { total: 900, volume: 1 });
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
});
