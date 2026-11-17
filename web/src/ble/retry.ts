/**
 * How the bands reconnect by themselves after the link drops (src/ble/mendi.ts, src/ble/halo.ts).
 *
 * A dropped Bluetooth link is usually back within a second or two (the band was briefly out of range, the
 * computer's radio was busy), so the first attempts come quickly; then the loop keeps trying, more patiently,
 * for about a minute and a half before it hands the choice back to the player.  One attempt — a GATT connect and
 * the band's setup — must never hang the loop: it is abandoned after ATTEMPT_TIMEOUT_MS and the next one starts.
 */

/** The wait before each attempt (ms): ~95 s in all. */
export const RECONNECT_DELAYS_MS: readonly number[] = [500, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000];

/** One attempt gives up after this long (ms). */
export const ATTEMPT_TIMEOUT_MS = 12000;

/** `p`, or a rejection after `ms` milliseconds (the work behind `p` is not cancelled: its owner must ignore it). */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
