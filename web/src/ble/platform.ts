/**
 * Bluetooth availability and "please turn Bluetooth on" guidance.
 *
 * A web page cannot switch Bluetooth on by itself.  What it can do:
 *  - detect support (`navigator.bluetooth`) and adapter availability
 *    (`getAvailability()`, `availabilitychanged`; Chromium only),
 *  - let the browser's own device chooser prompt (Chrome on Android asks to
 *    turn Bluetooth on and for the "Nearby devices" permission),
 *  - show OS-specific steps, with a deep link where the OS has one
 *    (Windows `ms-settings:`, macOS System Settings).  Chrome blocks intent
 *    links to Android Settings, and iOS has no web-reachable settings URL.
 *
 * Support (MDN browser-compat-data): Chrome/Edge/Opera on Windows, macOS,
 * ChromeOS and Android; Linux behind a flag; no Firefox, no Safari, and no
 * browser on iOS except the third-party Bluefy browser.
 *
 * The texts are in the page's language (src/i18n/shell.ts).
 */
import { t } from '../i18n/shell';

export type Platform = 'windows' | 'macos' | 'linux' | 'chromeos' | 'android' | 'ios' | 'other';
export type BrowserKind = 'chromium' | 'firefox' | 'safari' | 'bluefy' | 'other';
export type BtStatus = 'unsupported' | 'insecure' | 'unavailable' | 'available';

interface NavLike {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; brands?: { brand: string }[] };
  bluetooth?: unknown;
}

const nav = (): NavLike => navigator as unknown as NavLike;

export function detectPlatform(n: NavLike = nav()): Platform {
  const p = (n.userAgentData?.platform ?? '').toLowerCase();
  const ua = n.userAgent;
  if (p === 'android' || /Android/i.test(ua)) return 'android';
  // iPadOS 13+ reports a Mac user agent; touch support gives it away
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (n.maxTouchPoints ?? 0) > 1)) return 'ios';
  if (p === 'windows' || /Windows/i.test(ua)) return 'windows';
  if (p === 'chrome os' || p === 'chromeos' || /CrOS/.test(ua)) return 'chromeos';
  if (p === 'macos' || /Mac OS X|Macintosh/.test(ua)) return 'macos';
  if (p === 'linux' || /Linux/.test(ua)) return 'linux';
  return 'other';
}

export function detectBrowser(n: NavLike = nav(), platform: Platform = detectPlatform(n)): BrowserKind {
  const ua = n.userAgent;
  if (platform === 'ios' && n.bluetooth) return 'bluefy';          // only Bluefy injects Web Bluetooth on iOS
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (n.userAgentData?.brands?.some(b => /Chromium|Google Chrome|Microsoft Edge|Opera/.test(b.brand))) return 'chromium';
  if (/Edg\/|OPR\/|Chrome\/|Chromium\//.test(ua) && !/CriOS/.test(ua)) return 'chromium';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

export async function bluetoothStatus(): Promise<BtStatus> {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  const bt = navigator.bluetooth;
  if (!bt) return 'unsupported';
  try {
    return (await bt.getAvailability()) ? 'available' : 'unavailable';
  } catch {
    return 'available';   // getAvailability missing (older Chromium / Bluefy): let the chooser decide
  }
}

/** Subscribe to adapter availability changes; returns an unsubscribe function. */
export function watchAvailability(cb: (available: boolean) => void): () => void {
  const bt = navigator.bluetooth;
  if (!bt?.addEventListener) return () => undefined;
  const h = (e: Event) => cb(Boolean((e as Event & { value?: boolean }).value));
  bt.addEventListener('availabilitychanged', h);
  return () => bt.removeEventListener('availabilitychanged', h);
}

export interface Guidance {
  title: string;
  steps: string[];
  link?: { href: string; label: string };
  /** true when pressing "Connect" can still work (the browser chooser may prompt by itself) */
  canConnect: boolean;
}

const BLUEFY = 'https://apps.apple.com/app/id1492822055';

const TURN_ON: Record<Platform, Omit<Guidance, 'canConnect'>> = {
  windows: {
    title: t('bt.win.title'),
    steps: [t('bt.win.1'), t('bt.win.2')],
    link: { href: 'ms-settings:bluetooth', label: t('bt.win.link') },
  },
  macos: {
    title: t('bt.mac.title'),
    steps: [t('bt.mac.1'), t('bt.mac.2')],
    link: { href: 'x-apple.systempreferences:com.apple.BluetoothSettings', label: t('bt.mac.link') },
  },
  android: { title: t('bt.android.title'), steps: [t('bt.android.1'), t('bt.android.2')] },
  chromeos: { title: t('bt.cros.title'), steps: [t('bt.cros.1')] },
  linux: { title: t('bt.linux.title'), steps: [t('bt.linux.1'), t('bt.linux.2')] },
  ios: { title: t('bt.ios.title'), steps: [t('bt.ios.1')] },
  other: { title: t('bt.other.title'), steps: [t('bt.other.1')] },
};

/** How the messages name the headband: the band itself, its phone app, and its entry in the browser's chooser. */
export interface BandNames { band: string; app: string; listed: string }
export const MENDI_NAMES: BandNames = { band: 'Mendi', app: 'Mendi', listed: 'Mendi' };
export const HALO_NAMES: BandNames = { band: 'BrainAccess HALO', app: 'BrainAccess', listed: 'BA HALO…' };

export function guidance(platform: Platform, browser: BrowserKind, status: BtStatus, names: BandNames = MENDI_NAMES): Guidance {
  if (status === 'insecure') return { title: t('bt.https.title'), canConnect: false, steps: [t('bt.https.1')] };
  if (status === 'unsupported') {
    if (platform === 'ios') {
      return { title: t('bt.bluefy.title'), canConnect: false, link: { href: BLUEFY, label: t('bt.bluefy.link') },
               steps: [t('bt.bluefy.1'), t('bt.bluefy.2'), t('bt.bluefy.3'), t('bt.bluefy.4')] };
    }
    if (platform === 'linux' && browser === 'chromium') {
      return { title: t('bt.flag.title'), canConnect: false, steps: [t('bt.flag.1'), t('bt.flag.2'), t('bt.flag.3')] };
    }
    const named = browser === 'firefox' ? 'Firefox' : browser === 'safari' ? 'Safari' : null;
    return { title: named ? t('bt.noWeb.named', { browser: named }) : t('bt.noWeb.this'), canConnect: false,
             steps: [t('bt.noWeb.1'), t('bt.noWeb.2')] };
  }
  const base = TURN_ON[platform];
  if (status === 'unavailable') return { ...base, canConnect: platform === 'android' };
  return { title: t('bt.connect.title', { band: names.band }), canConnect: true,
           steps: [t('bt.connect.1'), t('bt.connect.2', { app: names.app }), t('bt.connect.3', { listed: names.listed }), ...base.steps] };
}

export interface BleErrorInfo { message: string; cancelled: boolean; showGuidance: boolean }

/** Turn a Web Bluetooth exception into a user-facing message. */
export function explainBleError(e: unknown, names: BandNames = MENDI_NAMES): BleErrorInfo {
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (name === 'NotFoundError' && /cancel/i.test(msg)) return { message: t('bt.err.cancelled'), cancelled: true, showGuidance: false };
  if (name === 'NotFoundError' && /servic|characteristic/i.test(msg)) {
    return { message: t('bt.err.wrongDevice', { band: names.band }), cancelled: false, showGuidance: false };
  }
  if (name === 'NotFoundError' || /adapter not available/i.test(msg)) {
    return { message: t('bt.off'), cancelled: false, showGuidance: true };
  }
  if (name === 'SecurityError') {
    return { message: /gesture/i.test(msg) ? t('bt.err.gesture') : t('bt.err.security'), cancelled: false, showGuidance: false };
  }
  if (name === 'NotAllowedError') return { message: t('bt.err.blocked'), cancelled: false, showGuidance: true };
  if (name === 'NotSupportedError') return { message: t('bt.err.noBle'), cancelled: false, showGuidance: true };
  if (name === 'NetworkError') return { message: t('bt.err.network', { app: names.app }), cancelled: false, showGuidance: false };
  return { message: msg || t('bt.err.unknown'), cancelled: false, showGuidance: false };
}
