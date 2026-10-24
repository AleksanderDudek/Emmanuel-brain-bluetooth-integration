import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MendiDevice } from '../src/ble/mendi';
import { Engine, type EngineFrame, type SavedEvent } from '../src/engine';
import { DEFAULT_SETTINGS } from '../src/settings';
import { SessionDB } from '../src/storage/db';
import { FolderStore } from '../src/storage/folder';
import { SessionLibrary } from '../src/storage/library';
import { Recorder } from '../src/storage/recorder';
import { fakeMendi } from './helpers';

let dbn = 0;
const clock = { ms: 1_000_000 };
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(f => f()); vi.restoreAllMocks(); });

async function setup(device?: MendiDevice) {
  vi.spyOn(performance, 'now').mockImplementation(() => clock.ms);
  const db = await SessionDB.open(`engine-${dbn++}`);
  cleanups.push(() => db.close());
  const folder = new FolderStore(db);
  vi.spyOn(folder, 'getHandle').mockResolvedValue(null);
  const library = new SessionLibrary(db, folder);
  const engine = new Engine(new Recorder(db, 30), library, { ...DEFAULT_SETTINGS }, device);
  return { db, engine, library };
}

/** Advance the mocked clock and run one engine tick, like the 10 Hz interval would. */
function tick(engine: Engine, ms = 100): EngineFrame {
  clock.ms += ms;
  return engine.tick();
}

describe('Engine', () => {
  it('runs the simulator through pipeline and balance tracker', async () => {
    const { engine } = await setup();
    engine.simulator.generateFrames = () => engine.simulator.generate(3);
    let f = tick(engine);
    expect(f.source).toBe('simulator');
    expect(f.balance?.paused).toBe('waiting');
    for (let i = 0; i < 300; i++) f = tick(engine);   // 900 frames ≈ 29 s at 30.6 Hz
    expect(f.baseline_ready).toBe(true);
    expect(f.heart_rate_bpm).toBeGreaterThan(40);
    expect(f.balance?.paused).not.toBe('waiting');
    expect(f.simulator?.state).toBe('rest');
    expect(JSON.parse(JSON.stringify(f)).hbo.left).toBeTypeOf('number');
  });

  it('records what it processes and announces the saved session', async () => {
    const { engine, db } = await setup();
    engine.simulator.generateFrames = () => engine.simulator.generate(3);
    await engine.startRecording('próba', 600);
    expect(engine.mark('task_start')).toBe(true);
    for (let i = 0; i < 40; i++) tick(engine);
    const saved = new Promise<SavedEvent>(r => engine.addEventListener('saved', e => r((e as CustomEvent<SavedEvent>).detail), { once: true }));
    await engine.stopRecording();
    const { meta, movedToFolder } = await saved;
    expect(movedToFolder).toBe(false);
    expect(meta.sample_count).toBe(120);
    expect(meta.device).toBe('Simulator');
    expect(meta.markers.map(m => m.label)).toEqual(['task_start']);
    expect(await db.countChunks(meta.session_id)).toBeGreaterThan(1);
    expect(engine.mark('late')).toBe(false);
  });

  it('auto-stops at the configured duration and reports write errors once', async () => {
    const { engine, db } = await setup();
    engine.simulator.generateFrames = () => engine.simulator.generate(3);
    const errors: string[] = [];
    engine.addEventListener('error', e => errors.push((e as CustomEvent<string>).detail));
    const put = db.putChunk.bind(db);
    db.putChunk = async c => { if (c.seq === 0) throw new DOMException('quota', 'QuotaExceededError'); return put(c); };
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await engine.startRecording('auto', 10);
    for (let i = 0; i < 15; i++) tick(engine);          // > 30 frames → first chunk (fails)
    await engine.recorder.checkpoint();
    tick(engine);
    tick(engine);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/quota/);
    const saved = new Promise<SavedEvent>(r => engine.addEventListener('saved', e => r((e as CustomEvent<SavedEvent>).detail), { once: true }));
    now += 11_000;
    tick(engine);                                       // past the duration → stops by itself
    expect(engine.recorder.recording).toBe(false);
    const res = await saved;
    expect(res.error).toMatch(/nie została zapisana/);
    expect(res.meta.notes).toContain('niekompletne');
  });

  it('streams from the band, re-baselines after a reconnect and holds feedback on stale data', async () => {
    const fake = fakeMendi();
    cleanups.push(fake.stopFrames);
    const device = new MendiDevice({ graceMs: 20, reconnectDelaysMs: [10], bluetooth: fake.bluetooth });
    const { engine } = await setup(device);
    await engine.connectDevice();
    expect(engine.source).toBe('device');
    fake.stopFrames();                                   // deliver frames by hand from here on
    device.drain();
    let f!: EngineFrame;
    for (let i = 0; i < 380; i++) { fake.pushFrames(3); f = tick(engine); }
    expect(f.baseline_ready).toBe(true);
    expect(f.device.sensor_woken).toBe(true);
    expect(f.balance?.paused).not.toBe('waiting');

    for (let i = 0; i < 20; i++) f = tick(engine);       // 2 s without frames
    expect(f.balance?.paused).toBe('no_data');

    fake.drop();
    // the adapter reconnects and resumes by itself (polled: a busy test run can take longer than the 10 ms delay)
    await vi.waitFor(() => expect(device.isStreaming).toBe(true), { timeout: 2000, interval: 10 });
    fake.stopFrames();
    fake.pushFrames(3);
    f = tick(engine);
    expect(f.baseline_ready).toBe(false);                // new stream → new baseline
    await engine.disconnectDevice();
    expect(engine.source).toBe('off');
    expect(tick(engine).source).toBe('off');
  });
});
