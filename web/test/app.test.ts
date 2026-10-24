import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HaloDevice } from '../src/ble/halo';
import { EEGSimulator } from '../src/core/eeg/simulator';
import { EegEngine } from '../src/eeg-engine';
import { Engine } from '../src/engine';
import { Hub, oxygenation, type HubSample, type HubStatus } from '../src/hub';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '../src/settings';
import { SessionDB } from '../src/storage/db';
import { FolderStore } from '../src/storage/folder';
import { SessionLibrary } from '../src/storage/library';
import { Recorder } from '../src/storage/recorder';
import { FocusSession } from '../src/training/session';
import { parseRoute } from '../src/ui/router';

let dbn = 0;
const clock = { ms: 1_000_000 };
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(f => f()); vi.restoreAllMocks(); });

async function setup(over: Partial<AppSettings> = {}) {
  vi.spyOn(performance, 'now').mockImplementation(() => clock.ms);
  const db = await SessionDB.open(`app-${dbn++}`);
  cleanups.push(() => db.close());
  const folder = new FolderStore(db);
  vi.spyOn(folder, 'getHandle').mockResolvedValue(null);
  const settings: AppSettings = { ...structuredClone(DEFAULT_SETTINGS), ...over };
  const engine = new Engine(new Recorder(db, 30), new SessionLibrary(db, folder), settings);
  engine.simulator.generateFrames = () => engine.simulator.generate(3);
  const eeg = new EegEngine(new HaloDevice({ bluetooth: undefined }), new EEGSimulator(5, () => clock.ms));
  const hub = new Hub(engine, eeg, settings, () => saveSettings(db, settings));
  const statuses: HubStatus[] = [], samples: HubSample[] = [];
  hub.addEventListener('status', e => statuses.push((e as CustomEvent<HubStatus>).detail));
  hub.addEventListener('sample', e => samples.push((e as CustomEvent<HubSample>).detail));
  // tick the engines by hand (the hub listens to their 'frame' events)
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      clock.ms += 100;
      engine.dispatchEvent(new CustomEvent('frame', { detail: engine.tick() }));
      if (hub.tool === 'eeg') eeg.dispatchEvent(new CustomEvent('frame', { detail: eeg.tick() }));
    }
    return statuses.at(-1)!;
  };
  cleanups.push(() => { engine.stop(); eeg.stop(); });
  return { db, settings, engine, eeg, hub, tick, statuses, samples };
}

describe('Hub', () => {
  it('asks for a tool first, then follows the fNIRS simulator to a reliable signal', async () => {
    const { hub, tick, samples } = await setup();
    hub.start();
    hub.fnirs.stop();
    expect(tick().signal.reason).toBe('no_tool');
    await hub.setTool('fnirs');
    expect(tick().signal.reason).toBe('off');
    await hub.useSimulator();
    let s = tick(5);
    expect(s.source).toBe('simulator');
    expect(s.signal.reason).toBe('baseline');
    s = tick(120);   // the 10 s baseline
    expect(s.signal.reliable).toBe(true);
    expect(s.signal.quality).toBe('good');
    expect(s.signal.heartRate).toBeGreaterThan(40);
    const last = samples.at(-1)!;
    expect(last.tool).toBe('fnirs');
    expect(last.x).toBeTypeOf('number');
    expect(last.dt).toBeCloseTo(0.1, 6);
    expect(hub.settings.simulator.fnirs).toBe(true);
  });

  it('a weak contact warns but does not pause; a band off the skin does', async () => {
    const { hub, tick, samples } = await setup({ tool: 'fnirs', simulator: { fnirs: true, eeg: false } });
    hub.start();
    hub.fnirs.stop();
    tick(130);
    // what a real Mendi often reports with a good fit: low SCI on the forehead channels, some room light
    const q = (label: string) => ({ sci: 0.31, ambient_ratio: 0.28, dc: 40000, label });
    const real = hub.fnirs.tick.bind(hub.fnirs);
    hub.fnirs.tick = () => {
      const f = real();
      f.quality = { left: q(labelL), right: q('poor'), pulse: q('good') } as never;
      return f;
    };
    let labelL = 'poor';
    let s = tick(3);
    expect(s.signal.reliable).toBe(true);
    expect(s.signal.warning).toBe('weak_contact');
    expect(s.signal.detail).toContain('SCI 0.31');
    expect(samples.at(-1)!.reliable).toBe(true);
    labelL = 'light_leak';
    expect(tick().signal.warning).toBe('light_leak');
    labelL = 'no_signal';
    s = tick();
    expect(s.signal.reliable).toBe(false);
    expect(s.signal.reason).toBe('poor_signal');
    expect(s.signal.warning).toBeNull();
  });

  it('switches to EEG: the fNIRS source goes off, the EEG engine runs', async () => {
    const { hub, tick, settings } = await setup({ tool: 'fnirs', simulator: { fnirs: true, eeg: true } });
    hub.start();
    hub.fnirs.stop();
    tick(3);
    await hub.setTool('eeg');
    hub.eeg.stop();   // ticked by hand
    expect(settings.tool).toBe('eeg');
    expect(hub.fnirs.source).toBe('off');
    expect(hub.eeg.source).toBe('simulator');
    let s = tick();
    expect(s.tool).toBe('eeg');
    expect(s.device.kind).toBe('halo');
    s = tick(15);
    expect(s.signal.reliable).toBe(true);
    expect(hub.busy).toBe(false);
  });

  it('serialises tool switches: quick clicks land in order', async () => {
    const { hub, settings } = await setup({ tool: 'fnirs' });
    hub.start();
    hub.fnirs.stop();
    const a = hub.setTool('eeg'), b = hub.setTool('fnirs');
    await Promise.all([a, b]);
    hub.eeg.stop();
    expect(hub.tool).toBe('fnirs');
    expect(settings.tool).toBe('fnirs');
    expect(hub.eeg.source).toBe('off');
  });

  it('carries the last input through an empty tick of a fresh stream', async () => {
    const { hub, tick, samples } = await setup({ tool: 'fnirs', simulator: { fnirs: true, eeg: false } });
    hub.start();
    hub.fnirs.stop();
    tick(130);
    const gen = hub.fnirs.simulator.generateFrames;
    hub.fnirs.simulator.generateFrames = () => [];   // one tick without frames
    tick();
    hub.fnirs.simulator.generateFrames = gen;
    const s = samples.at(-1)!;
    expect(s.reliable).toBe(true);
    expect(s.x).toBe(samples.at(-2)!.x);
  });

  it('lends the fNIRS frames to an embedded game only while fNIRS streams', async () => {
    const { hub, tick } = await setup({ tool: 'fnirs', simulator: { fnirs: true, eeg: false } });
    hub.start();
    hub.fnirs.stop();
    const spy = vi.spyOn(hub.games, 'tick');
    tick(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].length).toBeGreaterThan(0);
  });

  it('computes oxygenation as mean(ΔHbO − ΔHbR) over both sides, skipping warm-up NaNs', () => {
    const d = { hbo_left: Float64Array.of(NaN, 1), hbr_left: Float64Array.of(NaN, -0.5), hbo_right: Float64Array.of(NaN, 0.5), hbr_right: Float64Array.of(NaN, 0) };
    expect(oxygenation(d)).toBeCloseTo(1, 12);
    expect(oxygenation({ hbo_left: new Float64Array(0), hbr_left: new Float64Array(0), hbo_right: new Float64Array(0), hbr_right: new Float64Array(0) })).toBeNull();
  });
});

describe('FocusSession', () => {
  const sample = (x: number | null, p: Partial<HubSample> = {}): HubSample => ({ tool: 'fnirs', x, reliable: true, reason: null, warning: null, dt: 0.1, epoch: 1, ...p });

  it('ignores the signal during the mood check and breathwork', () => {
    const s = new FocusSession('fnirs', 30);
    for (let i = 0; i < 900; i++) s.onSample(sample(0));   // 90 s of a perfect signal before the calibration screen
    expect(s.phase).toBe('prep');
    expect(s.meter.calProgressNow).toBe(0);
    s.beginCalibration();
    expect(s.phase).toBe('calibration');
  });

  it('calibrates, plays, earns, finishes on time', () => {
    const s = new FocusSession('fnirs', 30);
    s.beginCalibration();
    for (let i = 0; i < 199; i++) s.onSample(sample(0));
    expect(s.phase).toBe('calibration');
    expect(s.onSample(sample(0)).calibrated).toBe(true);
    let stars = 0, finished = false;
    for (let i = 0; i < 300 && !finished; i++) {
      const out = s.onSample(sample(0.8));
      stars += out.star ? 1 : 0;
      finished = out.finished;
    }
    expect(finished).toBe(true);
    expect(s.scorer.points).toBeGreaterThan(50);
    expect(stars).toBe(Math.floor(s.scorer.points / 10));
    const r = s.toResult({ id: 'x', source: 'simulator', device: 'Symulator', scene: 'hills' });
    expect(r.completed).toBe(true);
    expect(r.played_sec).toBe(30);
    expect(r.series.length).toBeGreaterThanOrEqual(29);
  });

  it('takes the reference again when the engine starts a new baseline mid-game', () => {
    const s = new FocusSession('fnirs', 120);
    s.beginCalibration();
    for (let i = 0; i < 200; i++) s.onSample(sample(0));
    expect(s.phase).toBe('game');
    for (let i = 0; i < 50; i++) s.onSample(sample(0.8));
    const before = s.scorer.points;
    s.onSample(sample(5, { epoch: 2 }));                   // new ΔHb baseline: +5 µM is meaningless now
    expect(s.recalibrating).toBe(true);
    for (let i = 0; i < 150; i++) s.onSample(sample(5, { epoch: 2 }));
    expect(s.scorer.points).toBe(before);                  // no points on a stale reference
    for (let i = 0; i < 60; i++) s.onSample(sample(5, { epoch: 2 }));
    expect(s.recalibrating).toBe(false);
    expect(Math.abs(s.level!)).toBeLessThan(1);            // 5 µM is the new zero
  });

  it('ignores samples of the other tool', () => {
    const s = new FocusSession('eeg', 60);
    s.beginCalibration();
    s.onSample(sample(0));
    expect(s.meter.calProgressNow).toBe(0);
  });
});

describe('router', () => {
  it('maps hashes to views, keeps old links working', () => {
    expect(parseRoute('')).toMatchObject({ view: 'start', nav: 'start' });
    expect(parseRoute('#trening/focus')).toMatchObject({ view: 'focus', nav: 'trening' });
    expect(parseRoute('#balance')).toMatchObject({ view: 'balance', nav: 'trening', hash: 'trening/balance' });
    expect(parseRoute('#sessions')).toMatchObject({ view: 'sesje' });
    expect(parseRoute('#gra/holyholyholy3d')).toMatchObject({ view: 'gry', nav: 'gry', game: 'holyholyholy3d' });
    expect(parseRoute('#gry')).toMatchObject({ view: 'gry', nav: 'gry', game: null });
    expect(parseRoute('#gra/geoda')).toMatchObject({ view: 'arcade', nav: 'gry', arcade: 'geoda', game: null });
    expect(parseRoute('#gra/latarnik')).toMatchObject({ view: 'arcade', arcade: 'latarnik' });
    expect(parseRoute('#gra/motylarnia')).toMatchObject({ view: 'arcade', arcade: 'motylarnia' });
    expect(parseRoute('#gra/nope')).toMatchObject({ view: 'start' });
    expect(parseRoute('#whatever')).toMatchObject({ view: 'start' });
  });
});

describe('settings and storage upgrades', () => {
  it('fills in the games\' preferences for settings saved before they existed', async () => {
    const db = await SessionDB.open(`app-${dbn++}`);
    cleanups.push(() => db.close());
    await db.setSetting('app_settings', { ...DEFAULT_SETTINGS, arcade: undefined, tool: 'eeg' });
    expect((await loadSettings(db)).arcade).toEqual(DEFAULT_SETTINGS.arcade);
    await db.setSetting('app_settings', { ...DEFAULT_SETTINGS, arcade: { minutes: 10 } });
    expect((await loadSettings(db)).arcade).toEqual({ ...DEFAULT_SETTINGS.arcade, minutes: 10 });
  });

  it('reads settings saved before the tool switch as fNIRS on the simulator', async () => {
    const db = await SessionDB.open(`app-${dbn++}`);
    cleanups.push(() => db.close());
    await db.setSetting('app_settings', { storageTarget: 'browser', recordingDurationSec: 300 });
    const s = await loadSettings(db);
    expect(s.tool).toBe('fnirs');
    expect(s.simulator.fnirs).toBe(true);
    expect(s.recordingDurationSec).toBe(300);
    expect(s.training.minutes).toBe(5);
    const fresh = await loadSettings(await SessionDB.open(`app-${dbn++}`));
    expect(fresh.tool).toBeNull();
  });

  it('upgrades a v1 database: sessions stay, trainings appear', async () => {
    const name = `app-${dbn++}`;
    const v1 = await openDB(name, 1, {
      upgrade(d) {
        d.createObjectStore('sessions', { keyPath: 'session_id' }).createIndex('by_start', 'start_time');
        d.createObjectStore('chunks', { keyPath: ['session_id', 'seq'] }).createIndex('by_session', 'session_id');
        d.createObjectStore('settings');
      },
    });
    await v1.put('sessions', { session_id: 'old', start_time: 1 });
    v1.close();
    const db = await SessionDB.open(name);
    cleanups.push(() => db.close());
    expect((await db.listMeta()).map(m => m.session_id)).toEqual(['old']);
    await db.putTraining({ id: 't1', start_time: 5 } as never);
    await db.putTraining({ id: 't2', start_time: 9 } as never);
    expect((await db.listTrainings()).map(t => t.id)).toEqual(['t2', 't1']);
    await db.deleteTraining('t2');
    expect(await db.listTrainings()).toHaveLength(1);
  });
});
