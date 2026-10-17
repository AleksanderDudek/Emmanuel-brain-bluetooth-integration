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
 */

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
  /** true when pressing "Połącz" can still work (the browser chooser may prompt by itself) */
  canConnect: boolean;
}

const BLUEFY = 'https://apps.apple.com/app/id1492822055';

const TURN_ON: Record<Platform, Omit<Guidance, 'canConnect'>> = {
  windows: {
    title: 'Włącz Bluetooth w Windows',
    steps: ['Otwórz Ustawienia → Bluetooth i urządzenia i przestaw Bluetooth na „Włączone”.',
            'Albo kliknij ikonę sieci/głośnika na pasku zadań i włącz kafelek Bluetooth.'],
    link: { href: 'ms-settings:bluetooth', label: 'Otwórz ustawienia Bluetooth' },
  },
  macos: {
    title: 'Włącz Bluetooth na Macu',
    steps: ['Kliknij Centrum sterowania na pasku menu → Bluetooth → włącz.',
            'Za pierwszym razem macOS zapyta, czy przeglądarka może używać Bluetooth — zezwól (Ustawienia systemowe → Prywatność i ochrona → Bluetooth).'],
    link: { href: 'x-apple.systempreferences:com.apple.BluetoothSettings', label: 'Otwórz Ustawienia systemowe → Bluetooth' },
  },
  android: {
    title: 'Włącz Bluetooth na Androidzie',
    steps: ['Przesuń palcem w dół od góry ekranu i włącz kafelek Bluetooth.',
            'Po naciśnięciu „Połącz” Chrome sam poprosi o włączenie Bluetooth i o zgodę na „Urządzenia w pobliżu” (na starszym Androidzie: lokalizację).'],
  },
  chromeos: {
    title: 'Włącz Bluetooth w ChromeOS',
    steps: ['Kliknij zegar w prawym dolnym rogu → kafelek Bluetooth → włącz.'],
  },
  linux: {
    title: 'Włącz Bluetooth w Linuksie',
    steps: ['Włącz Bluetooth w ustawieniach systemu albo poleceniem: bluetoothctl power on.',
            'Chrome na Linuksie wymaga też flagi: chrome://flags/#enable-experimental-web-platform-features (wklej w pasek adresu, włącz, uruchom ponownie).'],
  },
  ios: {
    title: 'Włącz Bluetooth na iPhonie/iPadzie',
    steps: ['Ustawienia → Bluetooth → włącz (albo Centrum sterowania).'],
  },
  other: {
    title: 'Włącz Bluetooth',
    steps: ['Włącz Bluetooth w ustawieniach systemu.'],
  },
};

export function guidance(platform: Platform, browser: BrowserKind, status: BtStatus): Guidance {
  if (status === 'insecure') {
    return { title: 'Wymagane HTTPS', canConnect: false,
             steps: ['Przeglądarka udostępnia Bluetooth tylko stronom otwartym przez HTTPS (lub localhost).'] };
  }
  if (status === 'unsupported') {
    if (platform === 'ios') {
      return { title: 'iPhone / iPad: otwórz w przeglądarce Bluefy', canConnect: false, link: { href: BLUEFY, label: 'Bluefy w App Store' },
               steps: ['Safari i Chrome na iOS nie obsługują Web Bluetooth (ograniczenie Apple).',
                       'Zainstaluj darmową przeglądarkę Bluefy i otwórz w niej ten adres.',
                       'Włącz Bluetooth: Ustawienia → Bluetooth.',
                       'Do czasu połączenia możesz korzystać z symulatora.'] };
    }
    if (platform === 'linux' && browser === 'chromium') {
      return { title: 'Chrome na Linuksie: włącz Web Bluetooth', canConnect: false,
               steps: ['Wklej w pasek adresu: chrome://flags/#enable-experimental-web-platform-features',
                       'Ustaw „Enabled” i uruchom przeglądarkę ponownie.', 'Upewnij się, że działa BlueZ (bluetoothctl power on).'] };
    }
    const which = browser === 'firefox' ? 'Firefox' : browser === 'safari' ? 'Safari' : 'Ta przeglądarka';
    return { title: `${which} nie obsługuje Web Bluetooth`, canConnect: false,
             steps: ['Otwórz tę stronę w Chrome, Edge lub Operze (Windows, macOS, Android, ChromeOS).',
                     'Do tego czasu możesz korzystać z symulatora i przeglądać zapisane sesje.'] };
  }
  const base = TURN_ON[platform];
  if (status === 'unavailable') return { ...base, canConnect: platform === 'android' };
  return { title: 'Łączenie z opaską Mendi', canConnect: true,
           steps: ['Naładuj i włącz opaskę.', 'Zamknij aplikację Mendi na telefonie — opaska przyjmuje jedno połączenie naraz.',
                   'Naciśnij „Połącz” i wybierz „Mendi” z listy przeglądarki.', ...base.steps] };
}

export interface BleErrorInfo { message: string; cancelled: boolean; showGuidance: boolean }

/** Turn a Web Bluetooth exception into a user-facing message. */
export function explainBleError(e: unknown): BleErrorInfo {
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (name === 'NotFoundError' && /cancel/i.test(msg)) return { message: 'Anulowano wybór urządzenia.', cancelled: true, showGuidance: false };
  if (name === 'NotFoundError' && /servic|characteristic/i.test(msg)) {
    return { message: 'To urządzenie nie wygląda na opaskę Mendi (brak usługi Mendi) albo ma nieobsługiwane oprogramowanie.',
             cancelled: false, showGuidance: false };
  }
  if (name === 'NotFoundError' || /adapter not available/i.test(msg)) {
    return { message: 'Bluetooth jest wyłączony albo niedostępny.', cancelled: false, showGuidance: true };
  }
  if (name === 'SecurityError') {
    return { message: /gesture/i.test(msg) ? 'Połączenie trzeba rozpocząć kliknięciem.' : 'Bluetooth wymaga HTTPS i strony otwartej bezpośrednio (nie w ramce).',
             cancelled: false, showGuidance: false };
  }
  if (name === 'NotAllowedError') return { message: 'Przeglądarka lub system zablokowały dostęp do Bluetooth.', cancelled: false, showGuidance: true };
  if (name === 'NotSupportedError') return { message: 'To urządzenie nie obsługuje Bluetooth Low Energy.', cancelled: false, showGuidance: true };
  if (name === 'NetworkError') {
    return { message: 'Nie udało się połączyć — opaska poza zasięgiem albo połączona z telefonem (zamknij aplikację Mendi).',
             cancelled: false, showGuidance: false };
  }
  return { message: msg || 'Nieznany błąd Bluetooth.', cancelled: false, showGuidance: false };
}
