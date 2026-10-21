# BrainLink web app: design

This document describes how the web app (`web/`) is organised: what the user sees, how the
two headbands are managed, how the games get the live signal, and the focus training modelled
on Mendi's own. Decisions are recorded with the reason behind them, so they can be revisited.

## 1. Goals

1. **One app for both tools.** The user picks *Mendi (fNIRS)* or *BrainAccess HALO (EEG)*,
   and the whole app follows that choice. Each tool also has a simulator.
2. **Training first, instruments second.** Most sessions are "put the band on, train, see how
   it went". The live signal views, recordings and pipeline parameters stay available, but
   they sit behind that main path instead of filling a sidebar.
3. **Games from the fNIRS view, on one connection.** The trainings and both HolyHolyHoly games
   start from inside the app and use the band that is already connected. They never ask to
   pair it again.
4. **A browser copy of Mendi's default training**, driven by the same fNIRS pipeline.

## 2. Information architecture

```
┌ app bar ─────────────────────────────────────────────────────────────────┐
│ BrainLink   [ fNIRS · Mendi | EEG · HALO ]          ● Mendi · 82% · REC  │
├──────┬───────────────────────────────────────────────────────────────────┤
│ rail │  Start      — status, the next step, quick launch, recent results │
│      │  Trening    — focus training (Mendi-style), balance trainer, games │
│      │  Sygnał     — the live monitor of the chosen tool (+ recording)    │
│      │  Sesje      — training results and recordings                      │
│      │  Ustawienia — storage, pipeline parameters, about                  │
└──────┴───────────────────────────────────────────────────────────────────┘
          on phones the rail becomes a bottom tab bar
```

* **App bar**: a tool switch (segmented control) and a **device chip**: a status dot, the
  device name, battery and signal quality. Pressing the chip opens the **device sheet**
  (a `<dialog>`), the one place to connect, disconnect, pick the simulator, reset the
  baseline and get Bluetooth help. This replaces four sidebar cards.
* **Start** shows one primary action that depends on the state: *choose a tool*, then *connect
  or use the simulator*, then *wait for the baseline*, then *start training*. Under it are
  quick-launch tiles and the last results.
* **Trening** is the hub for activities. Each card says which tools it supports. Activities
  that need the other tool are shown greyed out, with the reason.
* **Sygnał** is the instrument view: the existing fNIRS monitor, or a new EEG monitor
  (metrics, traces, band powers, contact, combos). Recording controls live here, where the
  signal is.
* Deep links: `#start`, `#trening`, `#sygnal`, `#sesje`, `#ustawienia`, `#trening/focus`,
  `#trening/balance`, `#gra/holyholyholy`, `#gra/holyholyholy3d`. The old `#balance` and
  `#sessions` links are redirected.

**Why:** the old page put fourteen controls next to the charts and gave nobody a starting
point. Grouping by task (train / watch / review / configure) follows the platforms' navigation
guidelines: 3–5 top-level destinations, on a rail for large screens and a bottom bar for
compact ones.

## 3. Tool management

* `settings.tool: 'fnirs' | 'eeg'`, stored in IndexedDB. On the first run the user chooses it
  on the Start screen.
* There is one engine per tool: `Engine` (fNIRS, existing) and `EegEngine` (new). Only the
  active tool's engine ticks. Switching tools stops the other engine's source, and
  disconnects its band after a confirmation if it is connected or recording.
* `Hub` (`src/hub.ts`) owns both engines and publishes one **`HubStatus`** per tick:
  tool, source, device summary, signal state (`ready`, `reliable`, `reason`, progress) and a
  tool-independent **focus reading**. The app bar, Start and the trainings read only this, so
  they never branch on the tool.

### EEG in the browser

The EEG path is ported from the Python server, the same way the fNIRS path was:

| Python | TypeScript | Checked by |
|---|---|---|
| `halo_ble.py` (bleak) | `src/ble/halo.ts` (Web Bluetooth) | fixture packets + fake GATT |
| `dsp.py` (DC removal, 50 Hz notch, Welch, blinks) | `src/core/eeg/dsp.ts` | `test/fixtures/eeg.json` (SciPy) |
| `features.py` (6 metrics, combos) | `src/core/eeg/features.ts` | same fixture, tick by tick |
| `simulator.py` | `src/core/eeg/simulator.ts` | behavioural tests |

These stay on the server: the trained mental-state classifier (scikit-learn), guided
calibration, the combo editor and EEG recording. The EEG monitor says so in one line.
HALO reports no impedance over BLE, so contact is a labelled heuristic: the spread of the last
second is *flat* below 0.5 µV and *noisy* above 80 µV.

## 4. Games on the app's connection

Web Bluetooth connections belong to a document, and navigating to another page drops them.
A game opened in a background tab would also have its timers throttled. So games run **inside
the app**, in a full-screen `<iframe>` overlay, and the app forwards the band's raw frames to them.

```
BrainLink (hub)                                 game iframe (/holyholyholy/?hub=1)
Engine.tick ──'frames'──► GameHost ──postMessage──► HubDevice (MendiDevice look-alike)
                                                     └► NeuroBridge → its own pipeline,
                                                        baseline, balance tracker (unchanged)
```

* The protocol is `brainlink-hub` v1, same-origin only (origin checked on both sides):
  `hello` (game) → `welcome` (hub: tool, source, device info) → `frames` (batches at 10 Hz)
  and `status` (connection or source changed).
* `HubDevice` gives the game what `MendiDevice` gives it (`isStreaming`, `drain()`, `info`,
  `'change'`). This means the 2D game and the GDevelop game's `mendi-focus.js` keep their
  tested logic, including their own 5-minute activation window.
* Simulator frames are forwarded too, so a game can be tried, or smoke-tested, without a band.
* The games still work as standalone PWAs with their own Bluetooth connection. `?hub=1`
  only switches the source.

**Why not BroadcastChannel to a second tab?** Hidden tabs get 1 Hz timers, and after five
minutes one wake-up a minute. The hub's 10 Hz loop would stall under the game.

## 5. Focus training ("Trening skupienia"), modelled on Mendi

The browser version follows Mendi's default training step by step (see §6 for the
reference). It uses its own art and no Mendi logo or name inside the game.

**Flow:** setup → mood check → breathwork (optional) → calibration → game → summary.

| Step | What happens |
|---|---|
| Setup | Length 3 / 5 / 10 / 15 min (default 5). Breathwork on or off (1 min). Scene: *Wzgórza* (rolling hills, the default), *Wydmy*, *Śnieżne szczyty*, *Kosmos*. Display: glow, dynamic zoom, in-game metrics. Sound: soundscape and point chime. All of it is remembered. |
| Mood | "Jak się dziś czujesz?": five faces, then up to five feeling words. Can be skipped. Saved with the result. |
| Breathwork | Cyclic sighing for 60 s: inhale, a short top-up inhale, a long exhale, with blooming circles and a countdown. |
| Calibration | "Szukam przepływu krwi i tlenu…" (fNIRS) or "Szukam fal mózgowych…" (EEG). First the engine's own baseline, then **20 s of reliable signal** set the session reference. Motion or poor contact extends it, with the reason shown. Advice: "soft, unfocused attention". |
| Game | Full screen, on a canvas (see below). |
| Summary | Score ring with a label, the four numbers, the session curve, the day streak and any new milestone. |

**The game screen** (a copy of the mechanics, drawn originally):

* The orb stays at a fixed x (42 % of the width) and moves only vertically. It rides the
  leading edge of a **filled area chart** of the activity: the last ~40 s to its left,
  and the current level continuing flat to its right. The fill is a vertical gradient fixed to
  the screen (violet low, magenta at the baseline, pink to salmon up high), so the higher the
  curve, the warmer its top.
* A thin line marks the **baseline (+0 %)**. The orb starts on it.
* Layered hill silhouettes and clouds scroll with parallax. The landscape changes with the scene.
* **Stars** drop onto the curve each time 10 points are earned, with a soft chime.
* HUD: session progress bar; 💧 **Tlen** (points), 🧠 **Aktywność** (%), ⏱ **Kontrola** (s);
  an "Aktywność +x.x %" card bottom right. Tapping the screen hides or shows the HUD, and
  ✕ ends the session.
* Text cues fade in from time to time (in Polish): "Celem treningu jest poprawa skupienia",
  "…sterując grą umysłem", "Skup się, ale zostań rozluźniony", and later "Twój mózg staje się
  silniejszy z każdą sesją", "Chwilowe spadki to część drogi", "Miłego treningu!".
* While the signal is unreliable (motion, contact, no data), a quiet banner says why,
  the orb dims and no points are earned. The clock keeps running.

**Signal and numbers.** Each tool gives one scalar per tick, and the training only sees
that scalar (`src/training/meter.ts`):

* fNIRS: prefrontal oxygenation `x = mean(ΔHbO − ΔHbR)` over both sides (µM), from the
  engine's per-sample output.
* EEG: `x = ln(frontal β / α)` from the band powers.
* `activity % = 100 · (x − ref) / scale`. Here `ref` is the calibration mean, and it follows slow
  drift with a 10-minute time constant. `scale` is 4 µM for fNIRS (a task response of 0.8 µM
  shows as +20 %) and `ln 2 / 0.3` for EEG (a doubling of β/α shows as +30 %). These are display
  scales, not physiology, and say so in the UI's info text.
* **Tlen (points):** while reliable and at least +1 %, `1 + 2·min(1, activity/10 %)` points per
  second, so at most 3 points per second, about what Mendi gives.
* **Kontrola:** the longest hold at ≥ +1 %, with dips shorter than 1.5 s forgiven ("steadiness,
  not peak").
* **Aktywność** in the summary is the mean activity over the reliable part of the game.
* **Wynik dnia (0–100)**, like the Mendi Score, is *Commitment* plus *Performance*:
  * Commitment, up to 70: minutes today ×4 (up to 40), plus the days trained in the last 7
    ×(20/7) (up to 20), plus the day streak ×2 (up to 10).
  * Performance, up to 30: today's mean activity, with +20 % or more earning the full 30.

  Labels: *Dobry początek* < 30 ≤ *Budujesz rozpęd* < 50 ≤ *Solidna rutyna* < 70 ≤
  *Świetna forma* < 85 ≤ *Mistrzowska rutyna*.
* Milestones: first session, the 3rd, 7th and 30th day in a row, the 10th and 50th session,
  and the first 60 minutes.
* Results are kept in IndexedDB (`trainings` store, DB v2). They show on Start and in Sesje.
  If a recording is running, the training adds markers (`training:start`, `:calibrated`, `:end`).

**Sound:** a generated soundscape (a soft detuned pad with a slow filter sweep) and a bell
chime on every star, both from Web Audio, with no files. Both are on by default at a low
volume and have their own switches.

## 6. Mendi's default training (reference)

Sources: Mendi's help centre (articles 23357979765660, 23386367375772, 23379422651420,
23404574861340, 23380793513756, 23360788842012), the App Store and Google Play listings,
review videos from 2023 to 2026, and neurofounders.co (2026).

* **Rolling Hills skin:** a white ball over layered flat hill silhouettes and small clouds,
  with a magenta→purple filled band below it and a thin horizontal line. The ball keeps its
  x and rides the leading edge of a scrolling area chart. Stars stay on the curve where points
  were earned. The colours of the fill warm (pink, salmon) higher up.
* **Instruction:** "Relax and focus on gently moving it upward." When you focus the ball rises
  (or glows or spins). When focus drifts it falls. The lag is about 5 s (haemodynamics).
* **HUD:** a session progress bar, *Oxygenation* (points), *Neural Activity* (%) and
  *Control* (s). An "Neural Activity +x.x %" card. Tap to hide. About 3 points per second while
  the signal is elevated.
* **Definitions:** Neural Activity is how active the PFC is. Oxygenation is the changes in
  oxygen-rich blood flow. Control is how steadily you keep the focus, meaning consistency
  rather than peak strength.
* **Session:** 3 / 5 / 10 / 15 min. Before it come a mood check (5 faces, then feeling words),
  optional cyclic-sighing breathwork, and "Calibrating – Searching for blood flow and oxygen".
  After it comes the Mendi Score (Commitment up to 70 + Performance up to 30) with a label
  ("Building momentum", "Solid routine"), then Neural Activity %, Control s, Oxygenation p,
  Session min and an activity overview graph. There is a day streak and milestones.
* **Skins:** Rolling Hills, Space Quest, Flower Power, Desert Dunes, Snowy Mountains.
  **Display options:** glow, spin, dynamic zoom, vignette, in-game metrics, distractions.
* **Audio:** an ambient soundscape plus a star chime when points are earned.

## 7. Visual language

* **Concept: a night instrument.** The background is deep ink with a faint grain and a soft
  glow in the colour of the active tool. Text is warm off-white. Accents are reserved for
  meaning.
* **Tool colours** are used everywhere the tool shows (switch, chip, charts, training):
  fNIRS = *oxy coral* `#ff7a59` (HbO is red), EEG = *wave blue* `#7aa2ff`.
  Status: good `#3ddc97`, warning `#ffb020`, bad `#ff5a6a`.
* **Type:** *Fraunces* (soft optical-size serif) for headings and big numbers in the
  training, *Manrope* for the interface, *JetBrains Mono* for data. All three are bundled
  (`@fontsource-variable/*`), with no third-party requests, so the strict CSP and offline
  use still hold.
* **Motion:** one staggered reveal when a view opens, a breathing dot while the baseline
  is collected, and nothing else that moves without a reason. Everything respects
  `prefers-reduced-motion`.
* Accessibility: the existing patterns are kept (ARIA tabs → a navigation landmark with
  `aria-current`, live regions for status, visible focus rings, ≥ 44 px targets on touch).

## 8. Testing

* Unit: the EEG parity fixtures, focus meter, training scoring, hub protocol (`HubDevice` ↔
  `GameHost`), tool switching.
* End to end: `npm run app:smoke` runs headless Chrome through the app with the simulator. It
  chooses a tool, does a short focus training to its summary, opens the balance trainer,
  launches the 2D game in the overlay and checks that frames arrive, switches to EEG and
  checks the monitor, and checks every view at phone and desktop width for overflow.
