# Emmanuel web app: design

This document describes how the web app (`web/`) is organised: what the user sees, how the
two headbands are managed, how the games get the live signal, the focus training modelled
on Mendi's own, the four languages and the brand. Decisions are recorded with the reason
behind them, so they can be revisited.

UI texts are quoted in Polish where the decision was made on them; Polish is the source
language, and each text's English, German and Swedish forms are in the catalogs (§10).

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
5. **Four languages, one meaning.** Polish (the source), English, German and Swedish, each
   written for its readers rather than word for word (§10).
6. **A name that says what it is for.** Emmanuel, "God with us": the app trains the stillness
   where prayer begins, and says so plainly, without promising experiences (§11).

## 2. Information architecture

```
┌ app bar ─────────────────────────────────────────────────────────────────┐
│ Emmanuel   Headband [ Mendi · fNIRS | HALO · EEG ]  ● Mendi · 82% · REC  │
├──────┬───────────────────────────────────────────────────────────────────┤
│ rail │  Home      — status, the next step, "Train" and "Play" rows, today│
│      │  Training  — focus training (Mendi-style), balance trainer        │
│      │  Games     — 3 training games + HolyHolyHoly; the signal they read│
│      │  Signal    — the live monitor of the chosen band (+ recording,    │
│      │              "play with this signal")                             │
│      │  Sessions  — training results and recordings                      │
│      │  Settings  — language, storage, pipeline parameters, about        │
│      │  (every tab ends with where to get the headbands)                 │
└──────┴───────────────────────────────────────────────────────────────────┘
          on phones the rail becomes a bottom tab bar
```

* **App bar**: the wordmark, a band switch (segmented control: *Mendi* over a small *fNIRS*,
  *HALO* over *EEG*) and a **device chip**: a status dot, the device name, battery and signal
  quality. Pressing the chip opens the **device sheet** (a `<dialog>`), the one place to
  connect, disconnect, pick the simulator, reset the baseline and get Bluetooth help. This
  replaces four sidebar cards.
* **Home** shows one primary action that depends on the state: *choose a band*, then *connect
  or use the simulator*, then *wait for the baseline*, then *start training*. Under it are two
  labelled rows, **Train** (focus training, balance, the signal) and **Play** (every game, a
  swipeable shelf on phones), and today's results.
* **Training** holds the exercises, and **Games** holds the games. They are separate
  destinations because "where are the games?" was the first question after the first redesign.
  Each card says which bands it works with ("Mendi · HALO"), and activities that need the other
  band are greyed out with the reason. Games opens with one line saying which signal the games
  will read (the band, the simulator, or none), with the action that changes it, then two
  sections: **Training games** (§9, either band) and **HolyHolyHoly** (Mendi, playable without
  a band, in Polish).
* The Mendi **Signal** view starts with "play with this signal", which opens the games straight
  from the instrument view.
* **Signal** is the instrument view: the existing fNIRS monitor, or a new EEG monitor
  (metrics, traces, band powers, contact, combos). Recording controls live here, where the
  signal is.
* **Where to get a headband** (`src/ui/buy.ts`) ends every tab. While no real band streams it
  is a card: each band, what it measures and what it does here, the chosen one first. Once a
  band streams it shrinks to one quiet line. The links go to the makers' own shops
  (mendi.io, brainaccess.ai) in a new tab with `rel="noopener noreferrer"`. There are no prices
  (they change and differ by country), and a note says the app is not affiliated with the
  makers and earns nothing from the links.
* Deep links: `#start`, `#trening`, `#gry`, `#sygnal`, `#sesje`, `#ustawienia`, `#trening/focus`,
  `#trening/balance`, `#gra/holyholyholy`, `#gra/holyholyholy3d`, and the training games' lobbies
  `#gra/geoda`, `#gra/latarnik`, `#gra/motylarnia`. The slugs stay Polish in every language, so a
  shared link works for everyone. The old `#balance` and `#sessions` links are redirected.

**Why:** the old page put fourteen controls next to the charts and gave nobody a starting
point. Grouping by task (train / play / watch / review / configure) follows the platforms'
navigation guidelines: a handful of top-level destinations, on a rail for large screens and
a bottom bar for compact ones.

**Naming the bands.** People know their band by name, not by the technique, so the app names
the device everywhere: **Mendi** and **HALO** (**BrainAccess HALO** on first mention and where
it is bought or connected). The technique (fNIRS, EEG) is only a qualifier: the switch's small
subtitle, "Mendi (fNIRS)" in explanations, the instrument views. Cards and tags show bands,
never techniques, and no sentence names a band on one side and a technique on the other. (The
mixed form, "Z EEG gra działa bez opaski — opaskę Mendi czyta po przełączeniu na fNIRS", was a
reported bug; it now reads "Ta gra czyta tylko opaskę Mendi. Z HALO zagrasz bez opaski — albo
przełącz opaskę u góry na Mendi.") The bands are a *headband* / *opaska* / *Stirnband* /
*pannband*, never a "tool".

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
Emmanuel (hub)                                  game iframe (/holyholyholy/?hub=1)
Engine.tick ──'frames'──► GameHost ──postMessage──► HubDevice (MendiDevice look-alike)
                                                     └► NeuroBridge → its own pipeline,
                                                        baseline, balance tracker (unchanged)
```

* The protocol is `brainlink-hub` v1 (the app's first name, kept like the other internal
  identifiers, §11), same-origin only (origin checked on both sides):
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
* HUD: session progress bar; 💧 **Tlen** (*Oxygen*, points), 🧠 **Aktywność** (*Activity*, %),
  ⏱ **Kontrola** (*Control*, s); an "Aktywność +x.x %" card bottom right. Tapping the screen
  hides or shows the HUD, and ✕ ends the session.
* Text cues fade in from time to time (the Polish source): "Celem treningu jest poprawa skupienia",
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
* **Wynik dnia** (*Day score*, 0–100), like the Mendi Score, is *Commitment* plus *Performance*:
  * Commitment, up to 70: minutes today ×4 (up to 40), plus the days trained in the last 7
    ×(20/7) (up to 20), plus the day streak ×2 (up to 10).
  * Performance, up to 30: today's mean activity, with +20 % or more earning the full 30.

  Labels: *Dobry początek* < 30 ≤ *Budujesz rozpęd* < 50 ≤ *Solidna rutyna* < 70 ≤
  *Świetna forma* < 85 ≤ *Mistrzowska rutyna*.
* Milestones: a first session, streaks of 3, 7 and 30 days, the 10th and 50th session, and the
  first 60 minutes.
* **The streak forgives one missed day in any seven** (a "streak freeze", as in Duolingo, whose
  data show freezes keep people coming back): the missed day keeps the streak alive but does
  not count as a day, already on the morning after it (before the day's first session). Mendi recommends about three sessions a week, so a strict daily chain
  punished exactly the people doing it right.
* Results are kept in IndexedDB (`trainings` store, DB v2). They show on Home and in Sessions.
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
* **The brand mark** (§11): the wordmark lights *El* in the accent, and the icon's synapse holds
  the one gold star. Gold stays in the mark; the interface keeps its tool and status colours.
* Accessibility: the existing patterns are kept (ARIA tabs → a navigation landmark with
  `aria-current`, live regions for status, visible focus rings, ≥ 44 px targets on touch).

## 8. Testing

* Unit: the EEG parity fixtures, focus meter, training scoring, hub protocol (`HubDevice` ↔
  `GameHost`), tool switching.
* End to end: `npm run app:smoke` runs headless Chrome through the app with the simulator. It
  chooses a tool, does a short focus training to its summary, opens the balance trainer, plays
  every training game from its lobby through a 40 s session to its summary (taps, Space and
  the simulator's focus switch) and checks Sessions lists them, launches the 2D game in the
  overlay and checks that frames arrive, switches to EEG and checks the monitor, and checks
  every view at phone and desktop width for overflow. It runs in Polish (`?lang=pl`).
* While working on one game: `node scripts/arcade-shot.mjs --port <dev server> --game <id>
  [--lang de]` plays it from a running `vite` dev server and saves screenshots of the lobby, the
  calibration intro, play at three sizes and the summary.
* Languages (§10): every catalog has a test (`catalogProblems`), and the unit tests run in Polish
  (`test/setup.ts` pins it). `node scripts/i18n-shot.mjs --port <server>` visits every tab and
  lobby in all four languages at desktop and phone width, saves screenshots, and reports a page
  that scrolls sideways, cut-off text, Polish left on a non-Polish page and missing keys.

## 9. Training games: Geode, Lighthouse Keeper, Butterfly House

(*Gry treningowe: Geoda, Latarnik, Motylarnia*; German *Geode, Leuchtturmwärter,
Schmetterlingshaus*; Swedish *Geod, Fyrvaktaren, Fjärilshuset*.)

Three games whose every session is a neurofeedback session. The research behind them, why these
three, and the rules they share are in [`src/arcade/DESIGN.md`](src/arcade/DESIGN.md); each game's
rules are in its own module.

* **Where:** cards in Games (first section) and on Home's Play shelf. A card opens the game's
  **lobby** (`#gra/<id>`): an animated picture of the player's own world (their village, cabinet
  or glasshouse), "How your headband plays" in three lines, the player's progress (records,
  album, the daily challenge), the session length (3 / 5 / 10 min), sound and vibration, and the
  readiness of the signal with one button, "Play". They work with both bands (Mendi and HALO)
  and need a signal: the band or its simulator.
* **A session** (`src/arcade/runner.ts`) is full screen: the calibration is the game's own intro
  scene with a card at the bottom (reference progress, a rotating tip that teaches the controls
  or suggests a mental strategy), then 3-2-1, then play. The top strip holds the session time and
  the pause button; pause (also Escape, or a hidden tab) offers "Resume", "End and save"
  (after 30 s), "Discard", and the band's sheet, so a dropped band can be reconnected mid-session.
  Bad signal shows the same banner as the focus training, and the game freezes the brain's part
  at neutral. Time up waits for the current move (at most 30 s). A calibration under 5 minutes
  old on the same signal is reused, so "Play again" on the summary starts at once. The layer is
  modal (the app underneath is inert; the device sheet still opens above it), the session clock
  starts at "Start!", and a hidden tab, the back button or Escape during the countdown pause the
  game as soon as play begins, with every held key and pointer released for the game. An
  abandoned session leaves the game's progress as it was; a game that fails mid-play keeps the
  training (after 30 s) but not its half-changed progress.
* **The summary** leads with the game's own number (carats, boats, millimetres of wingspan), its
  record and highlights, then the training numbers (Activity, Control, Oxygen, time) with the
  session curve, then the day score and the streak.
* **Saved** as a training result with `kind: 'game'` and a `game` block (id, title, score, unit,
  best, stats), so Sessions, Home's "Last session", the day score, the streak and the milestones
  all include them. Each game's progress (album, records, unlocks, the daily challenge) is a JSON
  object in IndexedDB's settings store under `arcade:<id>`.
* **The signal for games** (`src/arcade/kit/focus.ts`): the training's activity % against an
  adaptive threshold (~60 % of the reliable time above it, never below +1 %; `adapt` 0.08 for
  block games), smoothed over ~2 s with hysteresis and a 3 s grace against Mayer waves. Push and
  rest blocks are judged once, at their end, fairly for both sides (`RoundJudge.from(tuning)`),
  and the session's contrast (push minus rest) is reported. A player's first three sessions get
  a lower floor and judges that lean further toward them on both sides (moving the threshold
  instead would make focus blocks easier only by making rest blocks harder).
* **Code:** `src/arcade/kit/` (focus, session, audio, juice, progress, the game contract), the
  runner and lobby, `registry.ts` (what the app shows without loading a game; each game is its
  own lazily loaded chunk), and one folder per game.

## 10. Languages

Polish, English, German and Swedish. Polish is the source of every text. The other three are
written for their readers rather than word for word: one glossary across the app (*Activity*,
*Control*, *Oxygen*, *Day score*; a *headband*, never a *tool*), "du" in German and Swedish,
each language's quotation marks (pl „…”, de „…“, sv ”…”), and no slogans or "concentrate
harder" (texts suggest strategies).

* **Which language** is settled once, when `src/i18n` is first imported, so any module may
  translate while it loads: a page's pinned language (`<meta name="i18n-lang">`), then `?lang=`,
  then the saved choice (`localStorage` key `brainlink.lang`), then the browser's preferred
  languages (Norwegian and Danish readers get Swedish), else English. **Settings → Language**
  saves a choice and reloads the app. A reload is simpler and safer than re-rendering a running
  training or game, and the choice is rare.
* **Catalogs** sit next to the code that shows them: `src/i18n/page.ts` (the static page),
  `shell.ts` (Home, Training, Games, the device sheet, Bluetooth help, Settings, where to buy),
  `training.ts`, `signal.ts`, `arcade.ts` (the runner and the lobbies), and
  `src/arcade/<game>/i18n.ts` for each game. `pl` is the source; `en`, `de` and `sv` are typed
  `Catalog<Key>`, so the compiler rejects a missing text. `translator()` turns a catalog into
  `t(key, params)`: `{name}` placeholders are filled from `params`, and a text with plural forms
  is chosen by `params.n` with `Intl.PluralRules` (Polish needs *one*, *few* and *many*).
* **Sentences, not pieces.** One key per sentence with placeholders. Translated fragments are
  never glued together, because word order differs.
* **Numbers and dates** go through `fmtNum`, `fmtSigned` (with a real minus sign) and `fmtDate`
  in the page's locale: 1,5 in Polish, German and Swedish, 1.5 in English. Instrument readouts
  (µM, Hz, SCI) keep fixed decimals.
* **Static HTML** carries the Polish texts with `data-i18n="key"` and
  `data-i18n-attr="aria-label:key"`. `main()` swaps in the page's language and then sets
  `data-texts` on `<html>`; until then the app is hidden (`html:not([data-texts]) .app`, shown
  anyway after 2 s), so no Polish flashes.
* **Fitting.** German and Swedish run 20–35 % longer than English. Long titles carry soft
  hyphens, labels wrap, and canvas texts are measured and shrunk. On a 390 px phone nothing may
  overflow, which `scripts/i18n-shot.mjs` checks (§8).
* **Saved data keeps ids, not words** (scenes, moods, games, milestones), so a session saved in
  one language reads in another. The stat labels stored with a game result are the exception:
  they stay in the language they were saved in.
* **In Polish only:** the two HolyHolyHoly games, whose text is a Polish story with Polish Bible
  verses. Each pins `<meta name="i18n-lang" content="pl">` (the 3D game's library inserts it
  before anything else loads), so the shared modules they use speak Polish, and their cards say
  "In Polish" in the other languages.

## 11. Brand: Emmanuel

**Emmanuel** is Hebrew *ʿImmanu-El*, "God with us" (Isaiah 7:14, Matthew 1:23). The project's
aim is to help a person come closer to God the Creator through the quiet, steady attention that
meditation and contemplative prayer cultivate, trained with live feedback from the band. The
message keeps the order the name gives: God is already with us, and the practice only helps us
notice. So the app says plainly that it trains attention and calm. It never claims to produce
faith or spiritual experiences, to "hack" or "unlock" anything, or to alter consciousness on
demand, and it says that it is not a medical device.

| | Polish | English | German | Swedish |
|---|---|---|---|---|
| Tagline | „Bóg z nami.” | "God with us." | „Gott ist mit uns.“ | ”Gud är med oss.” |
| Descriptor | Trenuj ciszę, w której zaczyna się modlitwa. | Train the stillness where prayer begins. | Übe die Stille, in der Gebet beginnt. | Träna stillheten där bönen börjar. |
| Psalm 46 | „Uspokójcie się, a wiedzcie, żem Ja Bóg.” (Ps 46,11, Biblia Gdańska) | "Be still, and know that I am God." (Psalm 46:10, KJV) | „Seid stille und erkennet, daß ich Gott bin.“ (Psalm 46,11, Luther 1912) | ”Bliven stilla och besinnen att jag är Gud.” (Psaltaren 46:11, Bibel 1917) |

The German tagline is never „Gott mit uns“: that was the motto on Prussian and Wehrmacht belt
buckles. „Gott ist mit uns“ keeps the meaning without the echo. Swedish keeps the full sentence,
*Gud är med oss*, for the same reason („Gott mit uns“ was also the Swedish army's field word at
Breitenfeld in 1631). The Bible verses are quoted from public-domain translations only, checked
against their texts; modern translations are under copyright.

**Where the message shows:**

* the app bar's wordmark `Emmanu<span>el</span>`, whose accent lights *El*, Hebrew for God;
* the document title ("Emmanuel · God with us" in each language) and the web manifest's name
  and description;
* Home on the first run: the title is the wordmark with the tagline ("Emmanuel. *God with
  us.*"), and the intro opens with the descriptor;
* **Settings → About Emmanuel**: what the name means, what the app does and does not do,
  Psalm 46 ("Be still…") in the reader's language, then privacy and the medical disclaimer;
* the icon (`public/favicon.svg`, from which the PWA icons are generated): a neuron whose
  synapse holds a small gold star, the place where attention meets the light;
* the desktop server's dashboards (`dashboard/`), which use the same wordmark.

**Voice:** quiet, warm, reverent without being churchy, honest; light in the games. Short
sentences, second person, no exclamation marks in the faith texts. Avoided words: "neurohacking",
"hack", "unlock", "altered states", "energy", "guaranteed", "cure", "therapy". Positioning,
audience, objections and voice are kept in `.agents/product-marketing.md` at the repository root.

**Internal names keep the first name**, BrainLink, so nothing a user has breaks: the IndexedDB
database `brainlink`, the `brainlink-hub` protocol, the `globalThis.brainlink` debug object, the
`brainlink.lang` storage key, CSS classes, file names, and the Python package `brainlink/`.
Saved sessions, installed apps and scripts keep working.
