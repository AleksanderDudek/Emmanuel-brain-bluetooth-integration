/**
 * Service worker registration and the "new version" offer. The game never
 * reloads by itself: a waiting update is offered on the map only (progress is
 * saved there), never in the middle of a room.
 */
import { registerSW } from 'virtual:pwa-register';

let apply: ((reload?: boolean) => Promise<void>) | null = null;
let ready = false;

/** Register the service worker; `onReady` fires once a new version is waiting. */
export function setupPwa(onReady: () => void): void {
  apply = registerSW({
    onNeedRefresh() { ready = true; onReady(); },
  });
}

export function updateReady(): boolean { return ready; }

/** Activate the waiting version and reload. */
export function applyUpdate(): void { void apply?.(true); }
