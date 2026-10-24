import { afterEach, describe, expect, it } from 'vitest';
import { AFE_CONTROL1, AFE_TIMEREN, CHR, MendiDevice, type AfeMemory } from '../src/ble/mendi';
import { detectBrowser, detectPlatform, explainBleError, guidance } from '../src/ble/platform';
import { decodeSensor } from '../src/core/proto';
import { fakeMendi, sleep } from './helpers';

let cleanup: (() => void)[] = [];
afterEach(() => { cleanup.forEach(f => f()); cleanup = []; });

describe('MendiDevice', () => {
  it('wakes an idle optical front-end and restores it on stop', async () => {
    const fake = fakeMendi();
    cleanup.push(fake.stopFrames);
    const m = new MendiDevice({ graceMs: 30 });
    const info = await m.connect(fake.device);
    expect(info).toMatchObject({ connected: true, firmware: '1.0.1', hardware: 'r2.1b-ty1' });
    await sleep(10);
    expect(m.info.diagnostics).toEqual({ imu_ok: true, sensor_ok: true, voltage_mv: 3770 });   // came as a notification

    await m.startStream();
    expect(fake.regs.get(AFE_CONTROL1)).toBe(AFE_TIMEREN);
    expect(m.info.sensor_woken).toBe(true);
    await sleep(80);
    const frames = m.drain();
    expect(frames.length).toBeGreaterThan(3);
    expect(frames[0].ir_l).toBe(50000);
    expect(frames[0].timestamp).toBeGreaterThan(1e9);

    await m.stopStream();
    expect(fake.regs.get(AFE_CONTROL1)).toBe(0);
    expect(fake.chars[CHR.frame].notifying).toBe(false);
  });

  it('leaves firmware that streams on its own untouched', async () => {
    const fake = fakeMendi({ streamsOnItsOwn: true });
    cleanup.push(fake.stopFrames);
    // the grace has to see 5 frames of the 10 ms emitter: 80 ms did, until a loaded runner delayed the timer
    const m = new MendiDevice({ graceMs: 400 });
    await m.connect(fake.device);
    await m.startStream();
    const writes = fake.chars[CHR.sensor].writes.map(b => decodeSensor(b)!);
    expect(writes.some(s => !s.read && s.address === AFE_CONTROL1)).toBe(false);
    expect(m.info.sensor_woken).toBe(false);
    await m.stopStream();
  });

  it('reconnects after a drop and resumes streaming, but not after a user disconnect', async () => {
    const fake = fakeMendi();
    cleanup.push(fake.stopFrames);
    const m = new MendiDevice({ graceMs: 20, reconnectDelaysMs: [10, 10] });
    await m.connect(fake.device);
    await m.startStream();
    fake.drop();
    expect(m.isConnected).toBe(false);
    await sleep(120);
    expect(m.isStreaming).toBe(true);
    m.drain();
    await sleep(60);
    expect(m.drain().length).toBeGreaterThan(0);

    await m.disconnect();
    expect(fake.regs.get(AFE_CONTROL1)).toBe(0);           // original value restored despite the reconnect
    fake.drop();
    await sleep(60);
    expect(m.isConnected).toBe(false);
  });

  it('counts undecodable frames as invalid', async () => {
    const fake = fakeMendi({ streamsOnItsOwn: false });
    const m = new MendiDevice({ graceMs: 1 });
    await m.connect(fake.device);
    await m.startStream();
    fake.stopFrames();
    m.drain();
    fake.chars[CHR.frame].notify(Uint8Array.from([0x40]));     // truncated varint
    expect(m.info.frames_invalid).toBe(1);
    expect(m.drain()).toHaveLength(0);
    await m.stopStream();
  });
});

describe('MendiDevice battery safety', () => {
  const memory = (): AfeMemory & { map: Map<string, number> } => {
    const map = new Map<string, number>();
    return { map, get: id => map.get(id) ?? null, set: (id, v) => { map.set(id, v); }, clear: id => { map.delete(id); } };
  };

  it('restores the sensor on the next connection after the page died while it was woken', async () => {
    const fake = fakeMendi();
    cleanup.push(fake.stopFrames);
    const mem = memory();
    const first = new MendiDevice({ graceMs: 20, afeMemory: mem });
    await first.connect(fake.device);
    await first.startStream();
    expect(fake.regs.get(AFE_CONTROL1)).toBe(AFE_TIMEREN);
    expect(mem.map.get('dev-1')).toBe(0);                    // original saved before the write
    // tab closed: no stopStream, no disconnect. A fresh page connects again:
    const second = new MendiDevice({ graceMs: 20, afeMemory: mem });
    await second.connect(fake.device);
    expect(fake.regs.get(AFE_CONTROL1)).toBe(0);
    expect(mem.map.size).toBe(0);
  });

  it('keeps the pending restore when the write fails, and restores on disconnect even when not streaming', async () => {
    const fake = fakeMendi();
    cleanup.push(fake.stopFrames);
    const mem = memory();
    const m = new MendiDevice({ graceMs: 20, afeMemory: mem });
    await m.connect(fake.device);
    await m.startStream();
    fake.chars[CHR.sensor].failWrites = true;
    await m.stopStream();                                     // restore write fails
    expect(fake.regs.get(AFE_CONTROL1)).toBe(AFE_TIMEREN);
    expect(mem.map.get('dev-1')).toBe(0);
    fake.chars[CHR.sensor].failWrites = false;
    await m.disconnect();                                     // not streaming any more, still restores
    expect(fake.regs.get(AFE_CONTROL1)).toBe(0);
    expect(mem.map.size).toBe(0);
  });

  it('runs a single reconnect loop when the link drops again mid-reconnect', async () => {
    const fake = fakeMendi();
    cleanup.push(fake.stopFrames);
    const m = new MendiDevice({ graceMs: 10, reconnectDelaysMs: [15, 15, 15] });
    await m.connect(fake.device);
    await m.startStream();
    const before = fake.stats.connectCalls;
    fake.drop();
    fake.drop();                                              // second event while the first loop sleeps
    await sleep(120);
    expect(m.isStreaming).toBe(true);
    expect(fake.stats.connectCalls - before).toBe(1);
    await m.disconnect();
  });
});

describe('platform guidance', () => {
  const ua = {
    win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    linuxFx: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    cros: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  };

  it('detects platforms and browsers', () => {
    expect(detectPlatform({ userAgent: ua.win })).toBe('windows');
    expect(detectPlatform({ userAgent: ua.mac })).toBe('macos');
    expect(detectPlatform({ userAgent: ua.macSafari, maxTouchPoints: 5 })).toBe('ios');   // iPadOS
    expect(detectPlatform({ userAgent: ua.android })).toBe('android');
    expect(detectPlatform({ userAgent: ua.iphone })).toBe('ios');
    expect(detectPlatform({ userAgent: ua.linuxFx })).toBe('linux');
    expect(detectPlatform({ userAgent: ua.cros })).toBe('chromeos');
    expect(detectBrowser({ userAgent: ua.macSafari })).toBe('safari');
    expect(detectBrowser({ userAgent: ua.linuxFx })).toBe('firefox');
    expect(detectBrowser({ userAgent: ua.win })).toBe('chromium');
    expect(detectBrowser({ userAgent: ua.iphone, bluetooth: {} })).toBe('bluefy');
  });

  it('gives OS-specific steps and links', () => {
    expect(guidance('windows', 'chromium', 'unavailable').link?.href).toBe('ms-settings:bluetooth');
    expect(guidance('macos', 'chromium', 'unavailable').link?.href).toContain('x-apple.systempreferences');
    expect(guidance('android', 'chromium', 'unavailable').canConnect).toBe(true);   // Chrome's chooser prompts
    const ios = guidance('ios', 'safari', 'unsupported');
    expect(ios.link?.href).toContain('apps.apple.com');
    expect(ios.canConnect).toBe(false);
    expect(guidance('macos', 'firefox', 'unsupported').title).toContain('Firefox');
    expect(guidance('linux', 'chromium', 'unsupported').steps.join(' ')).toContain('chrome://flags');
    expect(guidance('windows', 'chromium', 'insecure').title).toContain('HTTPS');
  });

  it('explains Web Bluetooth errors', () => {
    const err = (name: string, message: string) => Object.assign(new Error(message), { name });
    expect(explainBleError(err('NotFoundError', 'User cancelled the requestDevice() chooser.')).cancelled).toBe(true);
    expect(explainBleError(err('NotFoundError', 'Bluetooth adapter not available.')).showGuidance).toBe(true);
    expect(explainBleError(err('SecurityError', 'Must be handling a user gesture to show a permission request.')).message).toContain('kliknięciem');
    expect(explainBleError(err('NetworkError', 'GATT Server is disconnected.')).message).toContain('aplikację Mendi');
    const wrong = explainBleError(err('NotFoundError', "No Services matching UUID fc3eabb0-c6c4-49e6-922a-6e551c455af5 found in Device."));
    expect(wrong.message).toContain('nie wygląda na opaskę Mendi');
    expect(wrong.showGuidance).toBe(false);
  });
});
