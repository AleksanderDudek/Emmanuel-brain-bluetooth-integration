# Exercise cards ("Karty ćwiczeń"): design

The exercise cards are 32 printed brain-training cards ("Wersja 4K", redrawn from photos of a
workbook). This module does three things with them:

1. **A printable set.** Anyone can download all 32 cards (PDF or a ZIP of PNGs) or one card, and
   do them on paper while the app records a Mendi or HALO session (*the paper session*, §6.2).
2. **Two-screen games.** 25 of the cards became 10 interactive games. One screen, the *board*,
   shows the cue and the rule. A second screen, the *pad* (a phone, a tablet, a second window or
   the other half of the same screen), has the buttons. Every trial is timed and judged, every
   session is kept, and the difficulty follows the player.
3. **Games with the band.** The same games with the headband recording along in a block design
   (rest, play, rest), so a session also shows how prefrontal activity changed while playing.

Decisions are recorded with the reason behind them. UI texts are Polish first (the source
language); English, German and Swedish are in `i18n*.ts`.

## 1. Where it lives in the app

* **Trening → "Karty ćwiczeń"** (an activity card, `CARDS_ACTIVITY` in `entry.ts`) and a tile on
  Start. Routes: `#karty` (home), `#karty/07` (one card), `#karty/gra/palce` (a game's lobby),
  `#karty/gra/dzien` (the day's workout).
* `entry.ts` is the only part loaded with the app. It is small; the module itself (views, games,
  texts, styles, Poppins) is a lazy chunk loaded the first time a `#karty` route opens, so the
  app's start-up does not pay for it.
* The module touches the app in a few places only: `ui/router.ts` (the route), `ui/activities.ts`
  and `ui/start.ts` (the card and the tile), `main.ts` (creating the entry, the hub, the
  `onTraining` callback, recording marks, and "a session is on" for the wake lock and the
  leave warning) and `vite.config.ts` (the pad page, caching).
* Its data is in a database of its own (§7). The app's `brainlink` database and its versions are
  never touched; band sessions are also handed to the app as ordinary training results.

## 2. The cards

`catalog.ts` lists the 32 cards: their times (read from the photos' badges: slow, medium, fast,
the book's turtle, dog and cheetah), tags, whether the redraw was corrected (§2.1), and, for the
7 print-only cards, why they have no game (§4.1).

### 2.1 Checked against the photos

Every 4K card was compared with its photo. 15 had errors in the redraw (missing or extra dots,
wrong colours, a wrong legend, rule tiles that did not match the photo); they were redrawn, and
the corrected images are the ones the app serves. Each corrected card says what was fixed
(`fix.cNN` in `i18n-cards.ts`). The cards' titles and instructions in the images stay in English,
as drawn; the app gives each card a title and a how-to in all four languages.

### 2.2 Files

* `public/cards/full/NN.png` — the corrected cards at 3840 px, quantised to 256 colours
  (about 270 KB each instead of 1.7 MB; the flat-colour artwork shows no banding). They are
  fetched only when wanted (a card's page, a download) and cached on first use; they are not
  part of the app's precache.
* `public/cards/thumb/NN.webp` — 720 px previews for the gallery (about 28 KB each), cached on
  first view.
* `print.ts` writes the downloads in the browser, with no library: a PDF (one A4 landscape page
  per card, the PNG re-encoded as a 3000 px JPEG at quality 0.9, the title as UTF-16) and a ZIP (stored,
  with CRC-32). Both writers are tested by reading their output back.

## 3. The look ("Wersja 4K")

The module copies the printed cards: a violet-to-navy frame (`#7B61FF → #494ECE → #0C3992`),
white panels on the cards' grey (`#F3F4F6`), a navy header with a coral number badge, flat
colours, Poppins. The palette (`palette.ts`) is the cards' own: navy, purple, coral, teal,
yellow, peach, magenta, violet, grey, ink. Every colour has a small symbol (`COLOR_MARK`) that
players can switch on in the lobby ("Oznaczenia kolorów"), for colour-blind players; the symbol
is drawn on both screens.

`art/draw.ts` draws every item (a dot, a crosshair, a quarter, a shape, a gesture, a numbered
disc, a die) the same way on the board and on the pad, so a coral dot or a fist looks the same on
both. The 13 hand gestures (`art/glyphs.ts`) were drawn to match the cards' hands.

All styles are scoped under `.k-theme` and `.k-pad`; `[hidden]` always wins over the classes'
`display`. Sizes on the board's stage use container units (`cqh`/`cqw`), not the window's, because
the stage can be a third of the screen beside the pad.

## 4. The games

### 4.1 Which cards became games, and why

A card became a game when its task has **a cue that can be shown and an answer that can be
tapped**, so the app can judge every response and time it. 25 cards qualified; they became 10
games (`games/index.ts`), each with levels taken from its cards:

| Game | Cards | Skill | What a trial is |
|---|---|---|---|
| Kolorowe palce | 07, 02, 14, 04 | reaction speed | a colour → the same colour (3, 4, then 5 fingers of a hand, then 6 discs) |
| Dłoń, pięść, kant | 03, 13, 21, 25, 30 | rules | a colour → its gesture (palm, fist, edge…; later counted repetitions and a rule that changes) |
| Znaki dłoni | 18, 27, 31 | rules | a colour, later a shape → a hand sign |
| Ćwiartki | 24 | rules | a coloured crosshair → its quarter |
| Obie ręce | 10, 05, 16, 23, 32 | coordination | two answers at once, one per hand; their gap is measured |
| Bez koloru | 20, 32 | inhibition | a number on a coloured tile → the number, not the colour (Stroop) |
| Powtórz pasek | 09, 04, 12 | memory | a strip shown colour by colour → tapped back in order (later in reverse) |
| Kod kolorów | 29 | memory | a code of digits → their colours (the wheel is shuffled every trial) |
| Szlak | 08, 19 | attention | numbered (later alternating) stops → tapped in order |
| Znajdź kolor | 17 | attention | find every dot of one colour among the others |

The 7 cards that stay on paper:

* **01, 06, 11, 15 — tracing** (lines, spirals, both hands at once). The task is the movement
  itself, which a tap cannot capture.
* **22 — unclear.** The photo does not settle what the colour pairs ask for; a game built on a
  guess would teach the wrong rule.
* **26 — counting on fingers.** The answer is a number shown with the fingers, which the screen
  cannot see.
* **28 — a hand on a hand.** The answer is the whole hand laid on a big coloured hand (with face
  parts as cues), which a tap does not capture.

They are all in the printable set and can be done with the band in a paper session (§6.2).

### 4.2 Difficulty that follows the player

A staircase (`adaptive.ts`): three successes in a row → one level up; two failures among the last
four → one level down. It settles where about four trials in five succeed, the edge where training
works. Memory spans use the span rule (one success → longer, two failures in a row → shorter).
The next session starts one level below where the last one ended, as a warm-up (the lobby says so
and can reset it).

### 4.3–4.7 The engines

* `mapping.ts` — the four rule games (§4.3). Every game starts with the rule on the board; higher
  levels play it from memory, faster; the last levels deal the rule anew mid-game. When every
  answer is its own cue (Kolorowe palce) there is no rule to show.
* `stroop.ts` (§4.4) — the number on the tile is the answer and the colour is the distractor;
  congruent and incongruent trials are recorded, and the summary shows the interference (median
  RT incongruent − congruent).
* `bimanual.ts` (§4.5) — two panels on the pad, left and right hand; both answers must be right,
  and the gap between the two taps is the coordination measure.
* `sequence.ts` (§4.6) — the strip (shown 650 ms per colour with 250 ms gaps; reversed every third
  strip from length 6) and the code.
* `field.ts` (§4.7) — the trail and the search, on a field of scattered dots. The board never shows
  where the dots are, so a portrait pad turns the field on its side to use the whole screen.

### 4.8 What is measured

Per trial (`TrialRecord`): correct or not, reaction time, taps, errors, the cue and the response,
timeout. Per session (`stats.ts`): accuracy, median reaction time of the correct trials and its
interquartile range (steadiness), errors, timeouts, the highest and the final level, and the
game's **headline**: correct units per minute of play (answers, code colours, trail stops or
targets), which rewards speed and accuracy together and compares sessions of different lengths.
For Powtórz pasek the headline is the longest strip copied. Progress (`store.ts progressOf`) is
the headline across sessions, the best, the level and the minutes played.

### 4.9 The day's workout

`dailyTrio(day)` picks three games for the day, one from each group: speed/rules, memory/attention,
coordination/inhibition. They are played 90 s each with a 15 s rest between them. Every day gives
a new trio as the days go by; the same day always gives the same one.

## 5. Two screens

### 5.1 The links

The board is authoritative: it decides, times and judges; the pad is a thin client that draws
what it is sent and reports touches. They talk with a small JSON protocol (`duo/protocol.ts`).
Three transports carry it (`duo/link.ts`):

| Mode in the lobby | Link | When |
|---|---|---|
| Na tym ekranie (this screen) | `LocalLink` | a tablet or laptop: the board and the pad share the screen |
| W drugim oknie (second window) | `ChannelLink` (BroadcastChannel) | a second window or a second monitor on the same computer |
| Na telefonie lub tablecie (phone) | `RelayLink` (WebSocket) | another device on the same Wi-Fi, through the desktop server |

Why a server for the phone: the app is served over HTTPS (GitHub Pages), and a page served over
HTTPS may not open `ws://` to the local network; browsers also offer no serverless way to find a
device on the LAN. The desktop server (`server.py`, port 8420) already runs on the user's
computer, so it serves a build of the app over plain HTTP at `/app/` (`npm run build:desktop`)
and relays messages between a board and its pads (`brainlink/duo_api.py`,
`ws://…/api/v1/duo/ws/{room}?role=board|pad&id=…`). Messages never leave the local network and
the relay keeps nothing. The board shows a QR code and a 4-character room code (no look-alike
characters); the pad page is `pad.html#r=ROOM&v=relay` and opens in the board's language
(`?lang=`).

### 5.2 Timing

* **Clock sync** (`duo/clock.ts`): the pad pings; the board answers at once with its time.
  offset = b − (a + c) / 2, taken from the sample with the smallest round trip among the last 12
  (within 60 s). Eight fast pings settle it, then one every 4 s follows drift. Each tap carries
  its time on the board's clock (`tb`).
* **Onset**: the board draws a cue inside an animation frame, and the frame's timestamp is the
  onset (`board/loop.ts`). **Response**: the pad uses `pointerdown` (not `click`, which comes a
  frame or more later) and the event's own timestamp. RT = tb − onset; taps under 100 ms are
  anticipations and do not count, and neither do taps made after the deadline. The timeout itself
  waits 150 ms past the deadline, so a tap made in time but still on its way over Wi-Fi lands.
* The trial cycle: a random wait (so the cue cannot be anticipated) → present → input until done
  or the deadline → the verdict for 380 ms. Practice trials (fixed level, not recorded) and a
  3-2-1 countdown come first.
* **Pauses**: the board pauses when its tab is hidden, and when the pad has been silent for 9 s
  ("the pad disconnected — waiting for it"); it carries on by itself when the pad is back.
  Paused time is not play time.

### 5.3 The pad

`pad/view.ts` draws the layouts (a grid, a ring, the hand of card 07, the crosshair's quarters,
a field), flashes the board's verdicts, vibrates on a miss, and steps back (dimmed) between games.
The same view runs embedded in the board's page, in a second window and on a phone
(`pad.html` + `pad/main.ts`: no Bluetooth, no database, a wake lock and a full-screen button).

### 5.4 The board's stage

`board/stage.ts`: the cue in the middle, the rule beside it while the level shows it ("Zasada z
pamięci" when it does not), the countdown, a word over the cue when the rule changes or the strip
is reversed.

## 6. The band

### 6.1 Games with the band

The band does not steer these games: it is recorded alongside them, as a lab records fNIRS or EEG
during a task (`board/band.ts`). A block design:

1. a 20 s rest at the start sets the reference (the focus training's calibration, with the same
   reliability checks); it can be skipped ("Graj bez opaski"). Practice and the countdown belong to
   neither block;
2. play blocks, one per game, marked in the recording (`karty:<game>:play`, every trial
   `k:<game>:<i>:<ok>`);
3. rest blocks between the workout's games.

The summary shows activity during play against the reference and the share of reliable signal;
every second of play is kept, aligned with the trials. Haemodynamics take seconds to rise and
fall, so the contrast between blocks is the meaningful number, not a single second. The numbers
are relative and consumer-grade, and the summary says so. With a Mendi connected (not the
simulator) the lobby can also record the raw signal with the trial marks, as the app's usual CSV.

A session with at least 20 s of band data is also saved as one of the app's training results,
so it counts in Sesje, the day and the streak. A game's result carries its headline; the day's
workout, whose three games count in different units, carries correct answers per minute across
all three.

### 6.2 The paper session

For any card, printed or on a tablet (`board/paper.ts`): a 20 s rest (the reference), then the
card three times (slow, medium, fast, the book's times), each started and stopped with "Gotowe",
with 15 s rests between. At the end the player gives the card's stars and the errors they noticed.
The app records the times and, with a band, the activity per attempt.

## 7. Data

`store.ts`: an IndexedDB database of its own, `brainlink-cards`, with two stores: `sessions`
(indexed by start time) and `kv` (the lobby's preferences). Levels and bests are worked out from
the sessions. A session (`CardSession`, v1) keeps
every trial, the levels, the link used, the clock-sync quality and the band's record. The home
page exports all trials as CSV (one row per trial) and any session as JSON.

## 8. Testing

* Unit (`test/cards-*.test.ts`): every engine played by a perfect and by an erring player through
  its levels (a `solve()` helper works out the right taps from what the screens show), the trial
  loop's timing, anticipations, pause and practice, clock sync, the links, room codes, the pad's
  message checks, the QR encoder (against reference matrices), the catalogs in four languages,
  the card set and its images, the PDF and ZIP writers, the store, the CSV, the routes.
* Relay: `tests/test_duo_relay.py` (pytest).
* End to end: `npm run build && npm run cards:smoke` plays, in headless Chrome on the simulator,
  a split-screen game with the band, a game with `pad.html` in a second window, the day's workout,
  the paper session's start, and (with `RELAY_URL=http://127.0.0.1:8420/app/` after
  `npm run build:desktop` and `python server.py`) a game with the pad over the relay. It checks
  every view at desktop and phone width for sideways scrolling and fails on any error.

## 9. Rights

The card layouts follow a commercial workbook's exercises. The printable set is meant for the
user's own practice and testing; check the rights before distributing it publicly.
