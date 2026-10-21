# BrainLink — web app (PWA)

BrainLink as an installable, offline-capable web app for **both headbands**:
**Mendi** (fNIRS) and **BrainAccess HALO** (EEG). It needs no Python server. The bands
connect through **Web Bluetooth**, the signal processing runs in the browser, and sessions are
stored **in the browser** (IndexedDB) or, optionally, in a **local folder** you choose. Each band
also has a simulator. The UI is in Polish.

What is in it (layout and decisions: [DESIGN.md](DESIGN.md)):

* **Start**: pick the band (fNIRS · Mendi or EEG · HALO; the switch at the top changes it
  any time). Below that are the one next step (connect, or use the simulator, then the
  baseline, then training), quick launch, and today's score.
* **Trening**:
  * **Focus training** (*Trening skupienia*), a browser copy of Mendi's default training.
    It has a mood check, breathwork, calibration and the game: an orb riding a scrolling
    activity curve over parallax hills, with stars for points. Then a summary with the day
    score, streak and milestones. It works with both bands.
  * The **hemispheric balance trainer** (fNIRS).
  * The two **HolyHolyHoly** games. They run *inside* the app and use the band that is
    already connected (see below).
* **Sygnał**: the live instrument view of the active band. fNIRS shows ΔHbO/ΔHbR, heart rate,
  SCI, motion, activation/asymmetry and recording with event markers. EEG shows six metrics,
  the traces after the 50 Hz notch, band powers, electrode contact and combos.
* **Sesje**: training results with their curves, and the recordings with CSV/JSON export.
* **Ustawienia**: storage, the MBLL parameters, exporting the training results.

## Where it works

| | Bluetooth (Mendi, HALO) | Simulators, trainings, sessions | Save to a folder |
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
npm test             # Vitest: codecs, fNIRS + EEG parity with the Python code, storage, Bluetooth adapters, hub, training
npm run build        # static site in dist/ (typecheck + app + both games + service workers + icons)
npm run preview      # serve dist/ locally
npm run app:smoke    # after a build: headless Chrome goes through the app on the simulators (screenshots in .smoke/)
```

Web Bluetooth needs **HTTPS** (or `localhost`). Any static host works:
GitHub Pages (workflow in `.github/workflows/web.yml`; set `BASE_PATH=/<repo>/`
and enable *Settings → Pages → Source: GitHub Actions*), Netlify, Cloudflare
Pages, or your own server.  To try it on a phone during development, use a
tunnel with HTTPS or deploy a preview.

Install it from the browser's menu or the *Zainstaluj* button. On
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

Focus-training results (points, control, mean activity, the per-second curve, mood) are kept in
IndexedDB too (store `trainings`). *Ustawienia → Dane treningów* exports them as JSON. A
recording running during a training gets its markers (`training:start`, `:calibrated`, `:end`).

## Architecture

```
src/
├── core/        pure TS, no DOM — unit-tested
│   ├── proto.ts       Mendi V4 protobuf codec (port of brainlink/mendi_proto.py)
│   ├── dsp.ts         Butterworth (zpk→SOS), sosfilt/sosfiltfilt, find_peaks — scipy semantics
│   ├── pipeline.ts    ambient → ΔOD → MBLL → ΔHbO/ΔHbR, HR, SCI, motion, metrics (port of brainlink/fnirs.py)
│   ├── simulator.ts   Mendi-like frames, block-design scenarios
│   ├── balance.ts     hemispheric balance tracker (port of brainlink/fnirs_balance.py)
│   ├── eeg/           EEG: DC removal + 50 Hz notch + Welch band powers + blinks (dsp.py),
│   │                  six metrics and combos (features.py), simulator (simulator.py)
│   ├── random.ts      seeded PRNG for the simulators
│   └── types.ts       snake_case shapes shared with the server's JSON
├── ble/
│   ├── mendi.ts       Mendi over Web Bluetooth: notifications, optical-sensor wake (fw 1.0.1), reconnect
│   ├── halo.ts        BrainAccess HALO over Web Bluetooth: stream config/start, delta decoding (halo_ble.py)
│   └── platform.ts    support/availability detection, "turn Bluetooth on" guidance, error messages
├── storage/     IndexedDB journal (v2: + training results), folder store, recorder, session library, CSV format
├── engine.ts    fNIRS 10 Hz loop: source → pipeline → recorder → balance → frame
├── eeg-engine.ts  EEG 10 Hz loop: source → DSP → metrics → frame
├── hub.ts       both engines, the active tool, one status + one training sample per tick
├── hub/         `brainlink-hub` protocol: lends the band's frames to a game in an <iframe>
├── training/    focus training: activity meter, scoring (day score, streak, milestones), session,
│                canvas scene, Web Audio soundscape
└── ui/          DOM views (built with createElement, no innerHTML): router, app bar, device sheet,
                 Start, Trening, focus training, balance, signal (fNIRS/EEG), sessions, settings, games
```

The fNIRS and EEG ports are checked against fixtures generated from the Python/SciPy
implementation (`npm run fixtures` regenerates them; `python3 scripts/make_fixtures.py eeg`
regenerates just one; this needs Python with numpy and scipy). A strict Content-Security-Policy
is set in `index.html`. Fonts are bundled (Fraunces, Manrope, JetBrains Mono), so there are no
third-party requests and the app works fully offline.

### Games inside the app

Web Bluetooth connections belong to a page, so opening a game in its own page would drop the
band. The app opens a game in a full-screen same-origin `<iframe>` (`/holyholyholy/?hub=1`)
and forwards the band's raw frames to it, or the simulator's, every tick (`src/hub/`). The
game's `NeuroBridge` gets a `HubDevice` instead of a `MendiDevice` and keeps its own pipeline,
baseline and balance tracker. In practice:

* a band connected in BrainLink is used by the game at once, with no second pairing;
* switching the source or reconnecting the band gives the game a new baseline;
* opened on their own, the games still pair the band themselves, as before.

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
npm run build        # builds BrainLink and both games into dist/, dist/holyholyholy/ and dist/holyholyholy3d/
```

## HolyHolyHoly 3D (the GDevelop game)

`game3d/` is a 3D reinterpretation of the game made with **GDevelop**: one of the seven
archangels guards a man or a woman in today's Poland, breaks their shadow-thoughts into
true sentences and tears down strongholds of lies; after each, Christ comes in a healing
scene and the person learns one real CBT skill. It mixes Archero, survivors-likes, Heroes vs
Hordes (gift slots, evolutions, reliquaries, heroes with their own prayer) and Endless
Puncher. The project (`game3d/project`) is generated from `game3d/generator/`, opens in the
GDevelop editor, and the build checks and exports it headlessly to `/holyholyholy3d/`. The
paintings are made locally with an open model (`game3d/tools/art.py`). It reuses the 2D
game's "Psalm 150" music engine, its Bible text and BrainLink's Mendi modules.
Details: [game3d/README.md](game3d/README.md); design (Polish): [game3d/DESIGN.md](game3d/DESIGN.md).

```bash
npm run dev:game3d     # export, then http://localhost:5175
npm run game3d:check   # validate the GDevelop project
npm run game3d:smoke   # headless Chrome plays a first chapter (after an export)
```

## Not in the web app (yet)

* **EEG extras.** The server still does these: the trained mental-state classifier
  (scikit-learn), guided calibration, the combo editor and EEG recording (`python run.py`; the
  official SDK on Windows/Linux). Live EEG, its metrics and the focus training work in the browser.
* **HALO contact.** HALO sends no impedance over BLE, so electrode contact is estimated from
  the signal's spread.
* **iOS without Bluefy.** This would need a native wrapper (e.g. Capacitor with a BLE plugin).
  The Bluetooth code sits behind `MendiDevice` / `HaloDevice`, so a native transport can be
  added without touching the rest.
