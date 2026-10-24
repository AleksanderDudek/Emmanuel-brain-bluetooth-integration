/**
 * Focus for HolyHolyHoly 3D, exposed as `window.MendiFocus` for the GDevelop extension of the
 * same name. It reuses the 2D game's tested modules unchanged:
 *   - NeuroBridge: the Emmanuel app's Mendi Web Bluetooth adapter, fNIRS pipeline and balance tracker;
 *   - FocusCharger / focusReading: held focus raises a ×1.5 / ×2 / ×3 multiplier.
 *
 * Without the band, standing still is focus (up to ×1.5), so the game is fully playable; the band
 * only adds (focus while moving, up to ×3). Nothing leaves the device. Opened from the Emmanuel
 * app (`?hub=1`), the app's band is used right away.
 *
 * Built into project/lib/mendi-focus.js by `npm run game3d:libs`.
 */
import { NeuroBridge } from '../../game/src/neuro/bridge';
import { embeddedInHub } from '../../src/hub/link';
import { focusReading, NO_BAND, type NeuroState } from '../../game/src/neuro/effects';
import { bandFocus, chargeFactor, FocusCharger, THRESHOLD, type FocusState } from '../../game/src/neuro/focus';

export type BandStatus = 'unsupported' | 'off' | 'connecting' | 'calibrating' | 'ready' | 'paused' | 'error';

export interface MendiFocusApi {
  readonly threshold: number;
  /** Web Bluetooth is available in this browser */
  supported(): boolean;
  /** Opens the browser's device chooser — call it right after a click or tap. */
  connect(): void;
  disconnect(): void;
  status(): BandStatus;
  /** last connection error, in Polish, for the UI */
  error(): string;
  /** 0..1 while the band calibrates its baseline */
  baselineProgress(): number;
  /** One tick: `still` = the angel has been standing still for a moment. */
  update(dt: number, still: boolean): void;
  /** a new chapter starts the streak afresh */
  reset(): void;
  level(): number;
  multiplier(): number;
  tier(): number;
  toNext(): number;
  /** 'band' | 'still' | 'none' */
  source(): string;
  focused(): boolean;
  /** true on the tick the multiplier went up */
  tierUp(): boolean;
  /** seconds of focus held without a break */
  held(): number;
  /** charge per second in units of the base rate (×multiplier when focused, a trickle otherwise) */
  chargeFactor(): number;
  /** heart rate from the band, 0 if none */
  heartRate(): number;
}

const message = (e: unknown): string => {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotFoundError') return 'Nie wybrano opaski.';
  if (name === 'SecurityError') return 'Przeglądarka wymaga kliknięcia, aby połączyć opaskę.';
  if (name === 'NotSupportedError' || name === 'NotAllowedError') return 'Ta przeglądarka nie pozwala na Bluetooth.';
  return e instanceof Error && e.message ? e.message : 'Nie udało się połączyć z opaską.';
};

export function createMendiFocus(makeBridge: () => NeuroBridge = () => new NeuroBridge()): MendiFocusApi {
  const charger = new FocusCharger();
  let bridge: NeuroBridge | null = null;
  let connecting = false;
  let lastError = '';
  let state: FocusState = charger.update(0, { level: 0, source: 'none' });
  const neuro = (): NeuroState => bridge?.state ?? NO_BAND;
  if (embeddedInHub()) {
    // opened from the Emmanuel app: its band (or simulator) is lent at once, no chooser
    bridge = makeBridge();
    bridge.followHub();
  }

  return {
    threshold: THRESHOLD,
    supported: () => NeuroBridge.supported(),
    connect() {
      if (connecting || !NeuroBridge.supported()) return;
      connecting = true;
      lastError = '';
      bridge ??= makeBridge();
      bridge.connect()
        .catch((e: unknown) => {
          lastError = message(e);
        })
        .finally(() => {
          connecting = false;
        });
    },
    disconnect() {
      void bridge?.disconnect();
    },
    status() {
      if (!NeuroBridge.supported()) return 'unsupported';
      if (connecting) return 'connecting';
      const n = neuro();
      if (!n.connected) return lastError ? 'error' : 'off';
      if (!n.baselineReady) return 'calibrating';
      return n.reliable ? 'ready' : 'paused';
    },
    error: () => lastError,
    baselineProgress: () => neuro().baselineProgress,
    update(dt, still) {
      const n = neuro();
      const band = n.source === 'band' && n.reliable;
      state = charger.update(Math.max(0, dt), focusReading(band ? bandFocus(n.activation) : null, still));
    },
    reset() {
      charger.reset();
      state = charger.update(0, { level: 0, source: 'none' });
    },
    level: () => state.level,
    multiplier: () => state.mult,
    tier: () => state.tier,
    toNext: () => state.toNext,
    source: () => state.source,
    focused: () => state.focused,
    tierUp: () => state.tierUp,
    held: () => state.held,
    chargeFactor: () => chargeFactor(state),
    heartRate: () => neuro().heartRate ?? 0,
  };
}

/** Publishes the API for the GDevelop extension. */
export function install(target: typeof globalThis = globalThis): MendiFocusApi {
  const api = createMendiFocus();
  (target as { MendiFocus?: MendiFocusApi }).MendiFocus = api;
  return api;
}
