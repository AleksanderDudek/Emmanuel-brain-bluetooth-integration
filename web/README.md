# BrainLink fNIRS — web app (PWA)

The Mendi fNIRS part of BrainLink as an installable, offline-capable web app.
It needs no Python server: the band connects through **Web Bluetooth**, the
signal pipeline runs in the browser, and sessions are stored **in the browser**
(IndexedDB) or, optionally, in a **local folder** you choose.

Features (same as `/fnirs` on the server): live ΔHbO/ΔHbR, heart rate, scalp
coupling index, motion flag, activation/asymmetry, the hemispheric balance
trainer, the simulator, recordings with event markers, and CSV/JSON export.
The UI is in Polish.

## Where it works

| | Bluetooth (band) | Simulator, sessions, trainer | Save to a folder |
|---|---|---|---|
| Chrome / Edge / Opera — Windows, macOS, ChromeOS | ✅ | ✅ | ✅ |
| Chrome — Android | ✅ | ✅ | ✅ (Chrome 132+) |
| Chrome — Linux | ⚠️ enable `chrome://flags/#enable-experimental-web-platform-features` | ✅ | ✅ |
| iPhone / iPad — Safari, Chrome, … | ❌ (Apple blocks Web Bluetooth) — use the **Bluefy** browser | ✅ | ❌ (export CSV instead) |
| Firefox, Safari on macOS | ❌ | ✅ | ❌ (export CSV instead) |

Source: MDN browser-compat-data (`Bluetooth.requestDevice`, `Window.showDirectoryPicker`).

**Bluetooth off?** A web page cannot switch Bluetooth on. The app detects it
(`navigator.bluetooth.getAvailability()`), shows OS-specific steps with a deep
link where one exists (Windows `ms-settings:bluetooth`, macOS System
Settings), and Chrome on Android prompts by itself when you press *Połącz*.

## Run

```bash
cd web
npm ci
npm run dev          # http://localhost:5173 (localhost counts as a secure context)
npm test             # Vitest: codec, DSP/pipeline parity with the Python code, storage, Bluetooth adapter
npm run build        # static site in dist/ (typecheck + build + service worker + icons)
npm run preview      # serve dist/ locally
```

Web Bluetooth needs **HTTPS** (or `localhost`). Any static host works:
GitHub Pages (workflow in `.github/workflows/web.yml`; set `BASE_PATH=/<repo>/`
and enable *Settings → Pages → Source: GitHub Actions*), Netlify, Cloudflare
Pages, or your own server.  To try it on a phone during development, use a
tunnel with HTTPS or deploy a preview.

Install it from the browser's menu or the *Zainstaluj aplikację* button. On
iOS (Bluefy or Safari): *Share → Add to Home Screen*.

## Storage

- **Browser (default)** — IndexedDB, written in ~5 s chunks while recording,
  so a crash or closed tab loses at most the last chunk; interrupted sessions
  are closed out on the next start. About **10 MB per hour**. The app shows
  usage/quota and can ask the browser to make storage persistent
  (`navigator.storage.persist()`), which protects it from eviction.
- **Local folder** — File System Access API (Chrome/Edge desktop, Chrome
  Android 132+). A session is journalled in IndexedDB while recording and
  written to the folder as `<id>_fnirs.csv` + `<id>_meta.json` when it ends;
  the browser copy is then freed. The folder is remembered; browsers re-ask
  for access after a restart (*Przyznaj dostęp*). Sessions already in the
  folder — including ones recorded by the Python server — show up in *Sesje*.

The CSV has the same columns as the server's recordings
(`brainlink/fnirs_recorder.py`), so both open in the same analysis scripts.

## Architecture

```
src/
├── core/        pure TS, no DOM — unit-tested
│   ├── proto.ts       Mendi V4 protobuf codec (port of brainlink/mendi_proto.py)
│   ├── dsp.ts         Butterworth (zpk→SOS), sosfilt/sosfiltfilt, find_peaks — scipy semantics
│   ├── pipeline.ts    ambient → ΔOD → MBLL → ΔHbO/ΔHbR, HR, SCI, motion, metrics (port of brainlink/fnirs.py)
│   ├── simulator.ts   Mendi-like frames, block-design scenarios
│   ├── balance.ts     hemispheric balance tracker (port of brainlink/fnirs_balance.py)
│   └── types.ts       snake_case shapes shared with the server's JSON
├── ble/
│   ├── mendi.ts       Web Bluetooth adapter: notifications, optical-sensor wake (fw 1.0.1), reconnect
│   └── platform.ts    support/availability detection, "turn Bluetooth on" guidance, error messages
├── storage/     IndexedDB journal, folder store, recorder, session library, CSV format
├── engine.ts    10 Hz loop: source → pipeline → recorder → balance → UI frame
└── ui/          DOM views (built with createElement, no innerHTML), PWA install/update
```

The DSP port is checked against fixtures generated from the Python/scipy
implementation (`npm run fixtures` regenerates them; needs Python with numpy
and scipy). A strict Content-Security-Policy is set in `index.html`; fonts are
bundled (no third-party requests), so the app works fully offline.

## HolyHolyHoly (the game)

`game/` is a second app in this package: **HolyHolyHoly**, a calm Christian
action game (Pac-Man × Archero × survivors) in which a guardian angel eats and
digests traumas, turning them into truths. It is served at `/holyholyholy/` as
its own installable PWA and reuses BrainLink's Mendi Bluetooth adapter, fNIRS
pipeline and balance tracker for optional prefrontal-cortex training: held
focus (from the band, or from stillness without it) charges the Fire of the
Spirit with a ×1.5/×2/×3 multiplier. Prayers are short "prayers of the heart"
held in focus, with nothing to read. The music, "Psalm 150", has its own piece
for each chapter.
Design (Polish): [game/DESIGN.md](game/DESIGN.md).

```bash
npm run dev:game     # http://localhost:5173/holyholyholy/
npm run build        # builds BrainLink and the game into dist/ and dist/holyholyholy/
```

## Not in the web app (yet)

- **BrainAccess HALO EEG** — still served by the Python server (`/`): it uses
  the official SDK on Windows/Linux and a trained classifier.
- **iOS without Bluefy** — would need a native wrapper (e.g. Capacitor with a
  BLE plugin); the Bluetooth code sits behind `MendiDevice`, so a native
  transport can be added without touching the rest.
