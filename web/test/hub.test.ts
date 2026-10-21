import { afterEach, describe, expect, it } from 'vitest';
import { NeuroBridge } from '../game/src/neuro/bridge';
import { Frame } from '../src/core/proto';
import { GameHost } from '../src/hub/host';
import { embeddedInHub, HubDevice, HubError } from '../src/hub/link';
import type { HubStatusMsg } from '../src/hub/protocol';
import { sleep } from './helpers';

const ORIGIN = 'https://brainlink.test';
/** long enough for a message round trip (each hop is a timer) */
const settle = () => sleep(25);

/** Two same-origin windows: the app and the game in its iframe. postMessage is async, like the real one. */
function windows() {
  const make = (search: string) => Object.assign(new EventTarget(), { location: { origin: ORIGIN, search } }) as unknown as Window & EventTarget;
  const hub = make(''), game = make('?hub=1');
  const wire = (target: Window, sender: Window) => {
    (target as unknown as { postMessage: (d: unknown, o: string) => void }).postMessage = (data, origin) => {
      if (origin !== ORIGIN) return;
      const clone = structuredClone(data);
      setTimeout(() => target.dispatchEvent(Object.assign(new Event('message'), { data: clone, origin: ORIGIN, source: sender })), 0);
    };
  };
  wire(hub, game);
  wire(game, hub);
  Object.assign(game, { parent: hub });
  Object.assign(hub, { parent: hub });
  return { hub, game };
}

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(f => f()));

function setup(initial: Partial<HubStatusMsg> = {}) {
  const w = windows();
  let status: HubStatusMsg = { tool: 'fnirs', source: 'simulator', streaming: true, epoch: 1, device: null, ...initial };
  const host = new GameHost(() => status, w.hub);
  host.attach(w.game);
  const dev = new HubDevice(w.game);
  cleanups.push(() => { dev.close(); host.close(); });
  return { w, host, dev, set: (s: Partial<HubStatusMsg>) => { status = { ...status, ...s }; } };
}

const frames = (n: number) => Array.from({ length: n }, (_, i) => new Frame({ ir_l: 50000 + i, red_l: 30000, acc_z: 16384 }));

describe('brainlink-hub protocol', () => {
  it('detects being embedded by the app', () => {
    const w = windows();
    expect(embeddedInHub(w.game)).toBe(true);
    expect(embeddedInHub(w.hub)).toBe(false);   // not in a frame
    Object.assign(w.game.location, { search: '' });
    expect(embeddedInHub(w.game)).toBe(false);  // a plain iframe, not opened by the app
  });

  it('welcomes the game and lends frames once it connects', async () => {
    const { host, dev } = setup();
    await settle();
    expect(host.connected).toBe(true);
    expect(dev.hub?.source).toBe('simulator');
    expect(dev.isStreaming).toBe(false);          // nothing until the game asks
    host.tick(frames(3));
    await settle();
    expect(dev.drain()).toHaveLength(0);
    await dev.request();
    await settle();
    host.tick(frames(4));
    await settle();
    const got = dev.drain();
    expect(got).toHaveLength(4);
    expect(got[0]).toBeInstanceOf(Frame);
    expect(got[0].accel_g[2]).toBeCloseTo(1, 3);  // getters work: real Frames again
    expect(dev.info.device_name).toBe('Symulator (BrainLink)');
    expect(host.sent).toBe(4);   // nothing was sent before the game connected
  });

  it('reports a new signal as a stop and a start (the game re-baselines)', async () => {
    const { host, dev, set } = setup();
    await settle();
    await dev.request();
    const seen: boolean[] = [];
    dev.addEventListener('change', () => seen.push(dev.isStreaming));
    set({ epoch: 2 });
    host.tick([]);
    await settle();
    expect(seen).toEqual([false, true]);
  });

  it('tells the game when the app has nothing to lend', async () => {
    const { host, dev, set } = setup({ tool: 'eeg', streaming: false });
    await settle();
    await expect(dev.request()).rejects.toBeInstanceOf(HubError);
    await expect(dev.request()).rejects.toThrow(/EEG/);
    set({ tool: 'fnirs' });
    host.tick([]);
    await settle();
    await expect(dev.request()).rejects.toThrow(/Połącz opaskę/);
    set({ streaming: true, source: 'device' });
    host.tick([]);
    await settle();
    await expect(dev.request()).resolves.toMatchObject({ connected: true });
  });

  it('stops sending after bye and resumes on the next connect', async () => {
    const { host, dev } = setup();
    await settle();
    await dev.request();
    await settle();
    await dev.disconnect();
    await settle();
    host.tick(frames(2));
    expect(host.sent).toBe(0);
    await dev.request();
    await settle();
    host.tick(frames(2));
    expect(host.sent).toBe(2);
  });

  it('ignores messages from other windows', async () => {
    const { w, dev } = setup();
    await settle();
    const stranger = new EventTarget();
    w.game.dispatchEvent(Object.assign(new Event('message'), {
      data: { proto: 'brainlink-hub', v: 1, type: 'status', tool: 'eeg', source: 'off', streaming: false, epoch: 9, device: null },
      origin: ORIGIN, source: stranger,
    }));
    expect(dev.hub?.tool).toBe('fnirs');
  });

  it("drives the game's NeuroBridge like a real band", async () => {
    const { host, dev } = setup();
    await settle();
    const bridge = new NeuroBridge(dev);
    cleanups.push(() => void bridge.disconnect());
    expect(bridge.viaHub).toBe(true);
    expect(bridge.hubReady).toBe(true);
    await bridge.connect();
    await settle();
    host.tick(frames(30));
    await sleep(150);
    expect(bridge.state.connected).toBe(true);
    expect(bridge.state.streaming).toBe(true);
  });
});
