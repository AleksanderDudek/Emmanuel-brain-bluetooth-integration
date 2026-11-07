# Gry treningowe: the arcade games (design)

Eight games built on the band's prefrontal signal: **Geoda**, **Latarnik** and **Motylarnia** (§3),
and **Arka**, **Urodzaj**, **Wzlot**, **Glina** and **Źródła** (§6), all rooted in the Christian faith
with gaming first (§5). Every session of them is a full neurofeedback session — calibrated, scored like the focus training, saved
with the trainings, counted toward the day score and the streak — with a game on top that borrows
the loops of today's most played mobile games. The app-level design is in `web/DESIGN.md` (§9);
this file records the research behind the games, why these three, and the shared rules.

## 1. What makes mobile games stick in 2025–2026

Figures are third-party estimates (Sensor Tower, AppMagic, GameAnalytics); use them for rank, not
precision.

* **The charts.** Block Blast! was the most downloaded game of 2025 (≈ 368 M) and is still top 3 in
  September 2026; the "arrows" escape puzzles (Arrows – Puzzle Escape, Amaze GO!, Arrow Puzzle)
  took 3 of the world's top 5 install spots in June 2026; merge-2 revenue grew +74 % (Gossip Harbor
  ≈ $100 M a month) and sort/screw puzzles tripled; Royal Match/Royal Kingdom lead match-3 with a
  build meta; Habby's Capybara Go!/Archero 2 lead roguelite choices; Pokémon TCG Pocket made the
  daily pack ritual a $1.6 B business. No game launched in 2026 reached the top-grossing chart, so
  there is no newer core to chase than these.
* **What carries over without ads or purchases:** one rule readable in 5 seconds (Smash Fest's
  "5-second" and "mute" tests); levels of 20–120 s inside 5–10 min sessions; untimed or
  auto-action cores that hide latency; a difficulty roller-coaster with honest near-misses; the
  free-to-play pain points (revives, lives, energy) re-priced in *seconds of focus*; a date-seeded
  daily challenge; forgiving streaks (Duolingo: a 7-day streak makes a return 2.4× likelier,
  freezes lift daily users); collections that are guaranteed to complete (published odds, pity,
  duplicates turned into dust); growth that is ready "tomorrow"; sound and haptics as feel.
* **Ethics, because this is a health app:** no loss-aversion punishment or streak shaming, no FOMO
  timers, no paid randomness, no fabricated near-misses, no infinite loops — "done for today"
  endings instead (peak-end), rest celebrated as part of training, the sensor blamed instead of
  the player when the signal fails.

## 2. What the signal allows (neurofeedback rules)

From 22 fNIRS-neurofeedback studies (Kohl 2020), Mendi studies (Boere 2023, 2024) and the
neurofeedback-game literature:

1. The haemodynamic response peaks 4–6 s (up to ~10 s) after the effort. **The brain drives slow,
   accumulating quantities** (reach, growth, colour, charge); **touch drives anything under 2 s.**
2. **Block designs:** 20–30 s "push" blocks alternate with 20–30 s rest blocks, starts jittered by
   a few seconds and announced by a 3–4 s telegraph. Rest is play, not waiting. Each block is judged
   once, at its end, from its last 15 s.
3. **Adaptive thresholds** keep the reward rate around 60–80 %; beginners get a positive bias that
   fades. About half of people never gain reliable control, so the game must stay fun without it:
   progress mostly from showing up, the brain adds size, rarity and depth.
4. **Never punish the signal.** Motion, poor contact or a new baseline freeze the brain's influence
   at neutral — no reward, no loss.
5. **Overload lowers prefrontal HbO** (three Tetris boards at once did, Boere 2024): touch play must
   stay moderate and self-paced.
6. **Mayer waves** (blood pressure, ~0.1 Hz) pass the pipeline and look like control: smooth over
   ~2 s, use hysteresis and grace, judge over 15 s windows.
7. **Strategies, not "concentrate harder"** (which predicts worse results): imagery, planning,
   mental arithmetic, recalling details. The calibration tips suggest them.
8. **Blind blocks** (no feedback, result revealed after) train regulation that transfers outside
   the game.

## 3. How the three were chosen

Six designers (arcade, cozy collection, puzzle, strategy/roguelite, merge/builder, flow) proposed
twelve concepts grounded in the research above, next to three in-house ones. They were judged on
four lenses — neurofeedback validity, stickiness, feasibility in canvas 2D, and the player's taste
(reward-not-punish, nothing cheap or preachy) — and the set had to be **distinct in world, in core
verb and in the regulation it trains.**

| | Geoda | Latarnik | Motylarnia |
|---|---|---|---|
| Borrowed core | Block Blast (placement, line clears) | one-tap timing (Pop the Lock, Knife Hit), hearts | TCG-pack reveal, Finch-like gentle collection, drawing |
| World | a geode in the dark: prismatic crystals | a Baltic night: a lighthouse beam on navy sea | a sunlit leaf and a glasshouse: paper and gouache |
| Hands do | drag crystals into gaps | tap when the beam crosses a boat | steer a caterpillar across a leaf |
| Focus (push) | grows the fed crystal; steadiness makes it clearer | stretches the beam's reach (far boats carry more) | appetite: faster eating, bolder lines |
| Rest | Szlif: calm polishes the round's best gem | Cisza: calm makes the sea glow and reveals amber | the chrysalis: calm deepens the wing's colours |
| Mendi metric made visible | Control → crystal clarity | Activity → light; Control → extra reach | Activity → stroke width; Control → a satin vein |
| Meta | a cabinet of 9 minerals × 4 tiers | a fishing village, an amber album, letters in bottles | an atlas of 18 Polish butterflies, eggs that hatch tomorrow |

Runner-up: **Przypływ** (an arrows escape puzzle in which your focus is the moon and lifts the
tide). It scored as high as Geoda, but it is also about boats in a harbour, which Latarnik owns.
It is the first candidate for a fourth game.

## 4. Shared rules (the kit)

`kit/focus.ts` turns the focus training's activity % into what a game reads: `level` (0..1, 0.5 at
an adaptive threshold that keeps ~60 % of reliable time above it, never under +1 %), `focused` and
`hold` (hysteresis 1.5 %, grace 3 s), `calm`; `RoundJudge` (a fair verdict for push and rest blocks:
without control either kind passes about two times in three) and `BlockContrast` (push minus rest,
the measure fNIRS studies use, immune to drift). Block games set `adapt: 0.08` so the threshold
does not chase the alternation. Beginners (fewer than three sessions) get a lower floor and judges
that lean further toward them on both sides; their share of time above the threshold stays the
game's own, so rest blocks do not get harder for them. `kit/session.ts` wraps the focus training's session, so each game
session reports the same Aktywność, Kontrola and Tlen numbers; a calibration under 5 minutes old is
reused, so "one more go" starts at once. The runner owns everything around the game (calibration as
the game's intro, countdown, pause, signal banners, the simulator switch, saving, the summary with
the day score); a game owns its canvas, its rules and its progress (`kit/types.ts`).

Every game must make progress with the smoke test's crude input (a tap in the centre every 0.65 s,
Space now and then, the simulator's focus on), so its headline score accrues during play.

## 5. Rooted in faith, gaming first

Emmanuel's games take root in Christian faith, but the game comes first: each core loop is one of
the most played mobile cores and must be fun without reading a word. The faith is the world, its
names and images, its grace, and Scripture at resting points — shown, never preached.

* **Practices as mechanics.** A push block is biblical meditation that fills the mind (picture,
  plan, count, recall), never "emptying" it; a rest block is stillness; the daily challenge is the
  day's bread; blind blocks are walking without seeing; a beginner's gentler judges are the bruised
  reed. The words stay plain: verdicts are named in craft and nature words (leaf, drop, feather,
  glaze), never holiness words.
* **Grace mechanics.** What goes wrong is caught, reshaped or carried — Noah's hand leads an animal
  back, the potter gathers the slumped clay, the parent eagle catches the eaglet, what spills from a
  basket goes to the gleaners. Nothing is ever lost for a bad signal or a bad move, and rest is
  celebrated.
* **Gift and craft.** Grace never waits on the band: every rescue, the base progress and the day's
  gift (the same for everyone who comes, Matthew 20) come from showing up and touch. The band only
  adds craft: reach, depth, rarity, beauty.
* **The band measures attention, not holiness.** No faith meter, no prayer power, no "blessings" as a
  currency, no promise that playing produces faith or an experience of God.
* **Reverence.** No depiction of God the Father; Jesus only indirectly; no cross as an object; no
  occult or New Age frames, no prosperity promises. Angels and demons appear only as §8.1 allows
  (the founder's decision of 2026-11-02, for Anioł Stróż and Zastępy). Each Bible symbol
  belongs to one game (the dove and the rainbow to Arka, the eagle to Wzlot, the Songs of Ascents to
  Źródła), so the set never repeats itself.
* **Scripture** comes only from `src/content/scripture.ts`, generated and checked against a second
  source in four public-domain editions (BSB, Biblia Gdańska, Luther 1912, Bibel 1917) by
  `web/scripts/fetch_scripture.py`. Every lobby opens with the game's root passage (the registry's
  `root`), and every summary closes with a passage that fits what happened in the session, a
  different one session by session (`kit/scripture.ts` `inTurn`); a game names passages by id and
  never types a verse. The passages load as a chunk of their own (`src/arcade/verse.ts`).

| | root passage (the lobby) | closing passages (the summary, by what happened) |
|---|---|---|
| Geoda | Isaiah 54:11-12 | a rare find: Matthew 13:45-46; a polished Szlif: Malachi 3:3; the cabinet complete: Revelation 21:19-20; else 1 Peter 2:5, Psalm 127:1 |
| Latarnik | Matthew 5:14-16 | a calm won: Mark 4:39; boats home: Psalm 107:29-30, Isaiah 43:2; Psalm 119:105 |
| Motylarnia | 2 Corinthians 5:17 | the atlas complete: Revelation 21:5; a new species: Psalm 104:24; a deep chrysalis: Ecclesiastes 3:1; Matthew 6:28-29, 6:26 |
| Arka | Genesis 8:1 | the dove's leaf: Genesis 8:11; a new kind: Genesis 8:17; Genesis 9:13, Psalm 36:6, Lamentations 3:22-23 |
| Urodzaj | Deuteronomy 8:10 | Ruth comes to the table: Ruth 2:16; a new fruit: Deuteronomy 8:8; the great cluster: Psalm 65:11; a spill: Leviticus 19:9, John 6:12; dew: Deuteronomy 32:2, Psalm 133:3; a new guest: Luke 14:13-14; the day's bread: Matthew 6:11; Psalm 126:5 |
| Wzlot | Deuteronomy 32:11 | a catch: Psalm 91:4; a high climb: Isaiah 40:31; new plumage: Psalm 103:5; Exodus 19:4 |
| Glina | Jeremiah 18:6 | a reshaped vessel: Jeremiah 18:4; a household's story complete: Numbers 6:24-26; a glass glaze: Isaiah 61:3; a calm fire: Psalm 37:7; 2 Corinthians 4:7, Colossians 3:23 |
| Źródła | Psalm 84:5-6 | a stage of the road: Psalm 121:1-2; a river-deep field: Isaiah 35:7; a nest: Psalm 84:3; a closed valley: Isaiah 41:18; green: 1 Corinthians 3:6; a Stream passed: Psalm 1:2-3; Isaiah 58:11, Psalm 23:1-3 |

## 6. The five faith games: how they were chosen

Six designers, each in one genre of the 2025–2026 charts (sort and escape puzzles, merge and
builders, rhythm, cozy craft, physics arcade, tiles and roguelites), proposed two concepts each, next
to four in-house ones: sixteen in all, every one rooted in a Bible story or a Christian practice.
Three judges scored every concept — neurofeedback validity and feasibility, the free-to-play
player's appetite, and faithfulness to Scripture and the guardrails — and the set had to differ in
genre, world, verb, the regulation skill it trains and its part of Scripture, from each other and
from the three earlier games.

| | Arka | Urodzaj | Wzlot | Glina | Źródła |
|---|---|---|---|---|---|
| Borrowed core | Arrows escape puzzles, Bus Jam's landing | Suika's physics merge | Tiny Wings' hold and release | pottery sims, Good Pizza's orders | Infinity Loop's rotate-to-connect |
| World | the ark's deck after the flood, a woodcut | a hillside orchard as an early-church floor mosaic | the biblical wilderness by day, in parallax | a whitewashed potter's courtyard | a pilgrim's relief map, seen from above |
| Hands do | tap an animal: it walks out the way it faces | aim and drop fruit | hold to dive, release to glide | pull and shape clay on the wheel | tap a stone to turn its channel |
| Push block | the Day: focus lays planks (more room on the landing) | Zbiór: focus sends the vine to draw alike fruit together | Lekcja lotu: attention opens the wings; returns are celebrated | Toczenie: an even focus raises the chalk line and trues the clay | Nurt: focus is the springs' flow |
| Rest block | the Evening: the deck sleeps, calm brings the dove's leaf | Rosa: under the linen, calm settles the dew | Wznoszenie: calm strengthens the thermals | Wypał: calm melts the ash into glaze | Sela: the stones rest, calm greens the valley |
| Skill | sustain | down-regulate | recover | modulate (an even level, not a peak) | switch |
| Root | Genesis 6–9 | Deuteronomy 8, Leviticus 19, Ruth 2, Luke 14 | Deuteronomy 32:11 | Jeremiah 18 | Psalm 84, the Songs of Ascents |

The runner-up was **Kłosy** (TriPeaks solitaire in Boaz's field), left out only because Urodzaj took
the harvest; it is the first candidate for a ninth game.

The Games tab now shows the arcade games by kind (puzzles: Geoda, Arka, Źródła; skill: Latarnik,
Urodzaj, Wzlot; creative: Motylarnia, Glina), opens with a **game of the day** (every game in turn,
the same for everyone that day), and marks a game the player has never played as new.

## 7. Three run games with the signal in sight: Posłaniec, Zacheusz, Pasterz

Asked for (2026-11-02): three entertaining games that take from **Subway Surfers**, **Super Mario Run**
and **Voodoo**'s games, use Mendi's fNIRS mechanics, and show the signal *inside* the mechanics.
Picked by the lead without a panel (the request names the cores), against the same lenses as §3
and §6: neurofeedback validity, the free-to-play appetite, feasibility in canvas 2D, faithfulness.

### 7.1 What each source does that carries over

| | Subway Surfers (SYBO) | Super Mario Run (Nintendo) | Voodoo (Helix Jump, Mob Control, Crowd City, Paper.io) |
|---|---|---|---|
| Core | endless 3-lane run, behind the runner; swipe ←/→ lanes, ↑ jump, ↓ roll | the hero runs by himself; one tap jumps, a longer press jumps higher; small enemies are vaulted automatically, walls are jumped from | one thumb, one rule, readable in a second; an "oddly satisfying" crowd or physics that makes anyone feel skilled |
| Hook | trains to run over via ramps, coin lines, power-ups on the track (jetpack, magnet, super sneakers, 2×), the hoverboard as a second chance, the World Tour city that changes each season | short hand-made courses with 5 special coins in three tiers (pink → purple → black) for replays; a bubble rewinds a fall instead of a game over; Remix 10 (ten micro-courses back to back) | 30–60 s levels with a progress bar, the count-up at the end (×1…×5 steps), a crowd that grows as you sweep it up |
| Meta | daily missions that lift a score multiplier, a word hunt, characters and boards to collect | Kingdom Builder: coins buy buildings, a kingdom that grows | skins, a level number that climbs, nothing to read |
| What we leave | the chaser (the guard and his dog): fear as the motor; game over on a crash | lives, the timer; enemies stomped | ads between levels, fail screens, "×2 if you watch" |

Carried over without the cheap parts: a crash is a stumble (the run goes on), a fall is a rewind,
a level always ends in its count-up, and every motor is joy, not pursuit.

### 7.2 The signal in sight (the pillar of the three)

The earlier eight games turn the signal into the world (a crystal grows, a beam reaches); these
three **also draw the signal itself, in the world's own material**, so the player learns its
rhythm by watching: the effort shows five seconds later, rest lets it sink, focus and rest blocks
alternate. Three layers in every one of the three games:

1. **The live gauge in the world** — one thing whose size or glow is `level` with a mark at the
   threshold (0.5): Posłaniec's dawn glow under the runner's feet and the heights' ladder, Zacheusz's
   sightline, Pasterz's call ring (its radius *is* the level, a dotted circle marks the threshold).
2. **The history** (`kit/trace.ts`, `SignalTrace`, 40 s) drawn as part of the scenery: Posłaniec's
   ribbon of dawn over the hills, Zacheusz's skyline of palms (one palm per second, its height the
   level, a gold crown above the threshold), Pasterz's footprints in the grass plus a shepherd's
   tally strip. The marks mean the same everywhere: gold above the threshold, a cool band behind rest
   blocks, a dotted gap where the band lost the signal (never a low value), a veil over a blind block
   that lifts at its end, and a bracket at the "now" end marking the band's delay (≈ 5 s Mendi, ≈ 1 s
   HALO) — the most common confusion of new fNIRS users, answered by a picture.
3. **The block card** after each block: the block's own curve in miniature, its verdict in craft
   words, and for a blind block the reveal of what the veil hid.

Everything in §2 and §5 holds: the brain drives slow quantities only, touch drives anything under
2 s; a bad signal freezes the brain's influence at neutral; nothing is ever lost for a bad signal.

### 7.3 Posłaniec — the messenger on the road (Subway Surfers)

*Isaiah 52:7 — "How beautiful on the mountains are the feet of those who bring good news."* An
early-church messenger carries the apostle's letters along the Roman road to the seven churches of
Asia (Ephesus, Smyrna, Pergamum, Thyatira, Sardis, Philadelphia, Laodicea — Revelation 1:11).

* **View and verb.** Pseudo-3D behind the runner, three lanes of Roman paving through hills at dawn;
  swipe or arrows: ←/→ lane, ↑ jump, ↓ slide; a tap on the left or right third moves a lane, a tap
  in the middle and Space jump (the smoke's input). Obstacles: carts and caravans (change lane, or
  run up a ramp onto a long covered wagon), low walls and fallen columns (jump), arches and branches
  (slide), goats crossing. Drachmas in lines and arcs; sandals (high jumps) and a satchel (magnet)
  on the road for everyone, band or not. Speed rises gently over a session.
* **Grace.** A hit is a stumble: a second slowed, the drachma combo resets, never an ending; two
  stumbles close together and a fellow traveller's mule cart carries the messenger past the next
  stretch.
* **Push — Na wyżyny** (*Habakkuk 3:19: He makes my feet like a deer's, He lets me walk on the
  heights*): `level` lights the dawn glow under the feet and widens the magnet; `hold` climbs a
  ladder of light beside the runner (5 s Mendi / 3 s HALO); at its top the messenger rises onto
  the heights — a road above the road, rich in drachmas and free of obstacles — and stays there while
  focused (grace 3 s, at most 12 s), then glides down onto a clear stretch.
* **Rest — Strażnice** (*Isaiah 52:8: your watchmen lift up their voices*): an evening stretch
  without obstacles, slower; watchtowers on both sides, each one's fire kindled by `calm` as it is
  passed. A passed block: the watchmen's song (a bonus of drachmas and a horn).
* **Blind — Mgła na przełęczy** (mist on the pass): every 4th push block from the 3rd session; the
  ribbon is clouded and the heights do not open; at the exit the mist lifts, the ribbon is revealed,
  and the block's last 15 s of focus become a bonus stretch of heights.
* **The signal in sight.** The ribbon of dawn (the history, top of the sky), the glow under the
  feet (live), the ladder (hold, Mendi's Control).
* **Meta.** The route to the seven churches: metres run add up across sessions, each city reached
  (2–6 km apart) delivers a letter — a postcard of the city and its line from Revelation 2–3 *by
  reference only* (no verse typed) — and changes the road's scenery. Drachmas fill the collection for
  the saints in Jerusalem (Romans 15:26), a jar whose milestones dress the messenger (cloak colours,
  sandals). Three missions at a time (slide under 10 arches, 20 s on the heights, 300 drachmas…),
  the day's road (seeded, the same for everyone) and the day's gift.
* **Headline.** Metres this session (`m`). **Closing:** reaching a city: Romans 10:15; the heights:
  Habakkuk 3:19; the watchmen's song: Isaiah 52:8; a long run: Philippians 3:14, 1 Corinthians 9:24,
  Hebrews 12:1; else Proverbs 25:25, 2 Thessalonians 3:1.

### 7.4 Zacheusz — the short man in Jericho (Super Mario Run)

*Luke 19:3-4 — he was trying to see who Jesus was, but could not see over the crowd, so he ran on
ahead and climbed a sycamore-fig.* Jesus is never shown: the procession is a cloud of dust, palm
branches and a crowd far ahead; the story's turn is a voice at the end of a course.

* **View and verb.** A side-scrolling auto-runner through Jericho, the city of palms: market stalls,
  flat roofs, awnings that bounce, ladders, walls, wells. Tap to jump, press longer to jump higher,
  tap again against a wall to jump off it; baskets, chickens and sleeping dogs are vaulted on their
  own. Courses of 40–60 s built from hand-made chunks (seeded), each ending at a sycamore-fig: the
  higher Zacchaeus lands in its branches, the more the finish counts (the flagpole).
* **Special coins.** Five special denarii per course in hard places; a course's set is silver, then
  gold, then purple on replays of the same course (Mario's pink, purple, black).
* **Grace.** A fall into a ditch or a well: a neighbour's rope pulls him back up a few seconds
  earlier (the bubble), unlimited; the denarii combo resets, nothing else.
* **Push — Wypatrywanie** (looking out, Luke 19:3): `level` unfolds the high way — awnings, rope
  bridges and palm fronds across the rooftops; below the threshold they are outlines, above it
  they are solid (each piece locks its state when it scrolls into reach, so the lag never pulls a
  floor from under a jump). `hold` brings the procession's dust closer on the horizon; a held view
  (6 s Mendi / 4 s HALO) is a "Widok": a burst of denarii on the roofs.
* **Rest — Cień sykomory** (the sycamore's shade): a shaded street without pits, at a walk; `calm`
  ripens the figs on the passing trees, picked as he passes. A passed block: a basket of figs.
* **Blind — Tłum** (the crowd): every 4th push from the 3rd session; the crowd hides the skyline and
  the high way stays as it is; at the exit the crowd parts, the palms are revealed, and the block's
  focus becomes a row of solid rooftops.
* **The signal in sight.** The skyline of palms (the history; one palm a second, the crown gold
  above the threshold, blue-green in rest, a stump where the signal failed), the sightline from his
  eyes toward the dust (live), the dust cloud's nearness (hold).
* **Meta.** Fourfold (Luke 19:8): the denarii go back to Jericho's households — twelve homes on the
  town map, each restored by its sum (a roof, a door, a goat, a vine); repairs never cost play,
  they only count what was gathered. Courses unlock in turn (a world of 12, then their replays);
  three missions; the day's course; the day's gift.
* **Headline.** Denarii this session (`unit(n)` bends). **Closing:** a course's high finish: Luke
  19:5; a household restored: Luke 19:8; a long view: Hebrews 12:2, Psalm 34:5; a fall rewound:
  Luke 19:10; else Luke 19:6.

### 7.5 Pasterz — the flock on the hills (Voodoo's crowd games)

*Luke 15:4-6 — the man with a hundred sheep who goes after the one that is lost.* The shepherd is
the parable's man, not a picture of Christ.

* **View and verb.** Top-down Judean hills: terraces, thorn bushes, rocks, a stream with stones,
  the fold of dry stone. The shepherd walks toward the finger (a tap sets a goal, a drag steers;
  arrows too). Sheep graze in small groups; any sheep inside the **call ring** joins the flock, which
  follows in a soft boids crowd (the satisfying part). Each pasture is a 45–60 s level with a bar
  (sheep gathered / sheep on the hill); it ends at the fold, where the flock files through the gate
  and the count runs up (Voodoo's end steps: every tenth sheep lights a step).
* **Grace.** Thorns snag a sheep (it waits and bleats; walk near to free it); sheep never fall off
  terraces; nothing is lost when the pasture ends — strays come home with the next.
* **Push — Wołanie** (the call, John 10:3): the ring's radius is `level` (a dotted circle marks the
  threshold, gold beyond it); `hold` sends the voice further — after 5 s Mendi / 3 s HALO a ripple
  crosses the hill, every sheep in sight looks up and walks toward the shepherd, and the lost lamb
  bleats (a compass mark shows where).
* **Rest — Nocna straż** (Luke 2:8): dusk falls over the hill, the flock lies down by the fire;
  `calm` lights the stars one by one and lulls the lambs to sleep; a passed block: the morning's
  lambs (sheep added to the flock).
* **Blind — Zmrok** (dusk): every 4th push from the 3rd session; the ring is dimmed and does not grow;
  at its end the ring flares by the block's last 15 s of focus and the footprints are revealed.
* **The signal in sight.** The call ring (live), the footprints behind the shepherd (the history on
  the ground: bright where the signal lay above the threshold), and a tally strip at the top
  (`drawTrace` in a parchment skin).
* **Meta.** The hundred (Luke 15:4): the flock grows across sessions toward a hundred; the lost lamb
  of each pasture is found by walking to it and carried on the shoulders to the fold, and gets a name
  and a bell (a collection of twelve). Three missions; the day's hill; the day's gift.
* **Headline.** Sheep gathered this session, in the flock and in the fold (`unit(n)` bends), so the
  number climbs the moment a sheep joins. **Closing:** the lost
  lamb carried home: Luke 15:4-6 or Isaiah 40:11; the voice across the hill: John 10:3, John 10:27; a
  calm night: Luke 2:8; a big flock: Ezekiel 34:12; else Psalm 100:3.

### 7.6 How they fit the set

| | Posłaniec | Zacheusz | Pasterz |
|---|---|---|---|
| Kind (the Games tab) | run | run | arcade |
| Borrowed core | Subway Surfers | Super Mario Run | Crowd City / Mob Control |
| Camera | behind the runner (pseudo-3D) | side view | top-down |
| Hands | lanes, jump, slide | one tap jump, wall jump | steer the shepherd |
| Push block | heights: hold lifts onto a road above the road | the high way unfolds with level | the call ring grows with level |
| Rest block | watchtowers kindled by calm | figs ripen in calm | stars and sleeping lambs |
| Skill | sustain (hold) | sustain then switch | switch |
| Signal in sight | ribbon of dawn + ladder | skyline of palms + sightline | call ring + footprints + tally |
| Symbols (exclusive) | the road, feet, watchmen, the seven churches | the sycamore-fig, Jericho's palms | sheep, the fold, the lost lamb |

The Games tab gains a section **Biegi** (runs: Posłaniec, Zacheusz) after the puzzles; Pasterz joins
the skill games. The game of the day now cycles through eleven.

### 7.7 The signal dock: the plain chart under every game

The in-world pictures of §7.2 teach the rhythm, but they ask the player to read a metaphor, and the
earlier eight games draw no history at all. A player asked the plain question — *"I do not see what
the band shows; is what I am doing reaching my brain right now?"* — so the runner now docks a strip
under every one of the eleven games (`src/arcade/dock.ts`), switched by the signal button in the top
bar and on by default (`settings.arcade.signal`). The game's canvas takes the room above it.

1. **The chart** — the last 45 s of activity % against the calibration's 0, through the same
   `SignalTrace` and `drawTrace` as the in-world histories, so the marks keep their meaning: the
   adaptive threshold dashed, gold above it, focus and rest blocks as named bands, a dotted gap where
   the signal failed, a veil over a blind block until it ends, and the band's delay bracketed and
   named at "now" ("~5 s opóźnienia").
2. **Now, in words** (`kit/coach.ts`, `SignalCoach`) — the block and its seconds, then one verdict:
   above the threshold ("Działa — +2,4% nad progiem"), rising, or below it; in rest, sunk, sinking,
   or still high. In the first seconds of a block, before the delay has passed, it says "wait" instead
   of "no". Bad signal is "no signal", never low; a blind block says nothing until it ends.
3. **The block** — when a push or rest block ends, its mean activity after the delay against the
   previous block of the other kind (the first push against the calibration): "Ostatni blok
   skupienia: +1,8% względem odpoczynku — mózg zareagował", about flat, or the other way (0.5 % is the
   line). This is the contrast fNIRS studies measure, and the honest answer to the player's question.
4. **The session** — focus − rest so far (`BlockContrast`).

The game says which block it is in through `ArcadeGame.signal()` (want: focus / rest / free, and
blind); a game without it is read as free throughout. The game's own block cards may judge a block
by time above the adaptive threshold (`RoundJudge`) while the dock compares means: the two can
differ on a close block, and the dock's numbers say why.

### 7.8 What to do, and what it drives: instructions in every game

The founder's next two complaints: *"the games don't tell me what I am supposed to do"* and *"the
coupling between the game's mechanic and the Mendi reading is not clear"*. Three answers, the same
in all fourteen games, driven by the registry's `brain` texts (what the signal above the threshold
does in this game, what calm does, and the names of the two quantities):

1. **The calibration card** gets "Jak sterujesz opaską": Skupienie → what it drives, Odpoczynek → what
   calm drives, Rękami → what the hands do, and one line on the conversion — the band measures
   activity against the calibration; above the threshold the game's quantity grows, 50 % at the
   threshold, 100 % well above it.
2. **The block banner**: when a push or rest block begins, the runner puts its instruction over the
   game for five seconds (never in the way of a tap): the block's name, *what to do in the head* — a
   concrete strategy that changes block by block (subtract sevens, words on a letter, plan tomorrow,
   picture a room; in rest: slow breathing, a soft forehead, listening, counting breaths) — and →
   what it drives in this game.
3. **The dock** keeps the task on screen for the whole block ("W głowie: …") and shows the game's own
   quantity as a gauge with the threshold marked at its middle ("Zasięg światła 72%"), next to the raw
   numbers (activity and threshold, in %): the conversion from the band to the game, in sight.

The strategies are those fNIRS neurofeedback studies use for the prefrontal cortex (mental arithmetic,
verbal fluency, planning, vivid imagery) and never "concentrate harder" (§5).

## 8. Three games the founder asked for: Anioł Stróż, Zastępy, Firmament

The founder asked for three games by name and model: a guardian angel defending a sleeping child,
built like the two-sided tap brawlers (Endless Puncher); angels against demons in waves from two
bases, built like the lane battlers (We Are Warriors!); and a match-3 saga about space and stars
(Candy Crush Saga), where held attention earns the special tools that finish a hard level. Each
takes the **genre's** core (the verbs, the loop, the progression) and makes it ours — our own
world, rules, roster, levels and art; no source game's names, numbers, layouts or assets are copied.

### 8.1 Angels, demons, nightmares (the reverence rule widened)

* **Angels** are God's messengers and guardians (Hebrews 1:14): sent, serving, never worshipped,
  never commanded by prayer or by the band. The player *plays* the angel's part in a story, the way
  an actor does; the light is God's, the angel carries it (John 1:5). Drawn with reverence: white,
  gold and light, wings, no glamour or weapons of cruelty — a sword or a spear of light, a shield,
  a trumpet.
* **Jesus is never shown.** In Anioł Stróż He sends the angel (Matthew 18:10) — said in the story
  card, never pictured; God the Father is never pictured.
* **Demons and nightmares** are shadows: ink, smoke, ash and ember eyes, silhouettes that dissolve
  into light. No gore, no blood, no occult signs, no horror for its own sake — a child must be able
  to play. They are always beaten by light and never win for good: a lost fight is a retreat, the
  next dawn always comes.
* **Exclusive symbols.** The child's bed, the night lamp and the dream to Anioł Stróż; the two gates,
  the hosts and the trumpet to Zastępy; the stars, the telescope and the constellations to Firmament.

### 8.2 Anioł Stróż — the guardian at a child's bed (two-sided tap brawler)

*Psalm 91:11 — "For He will command His angels concerning you, to guard you in all your ways."*
Jesus sends you to keep a child's sleep (Matthew 18:10). Each session is one night.

* **View and verb.** A side view of a child's bedroom at night (a cross-section: a window on the
  left, a door on the right, a warm lamp, toys); the child sleeps in a bed at the centre, the angel
  hovers over it. Zmory (nightmares: shadow creatures) creep in from both sides toward the bed. A tap
  on the left or right half (←/→, A/D) strikes that side with a sweep of light that reaches R; it
  hits the nearest Zmora inside the reach. A tap in the middle third and Space strike the side whose
  Zmora is nearer (the smoke's input). A strike with nothing in reach is a whiff: 0.25 s of recovery,
  the combo resets. Hits build a combo (×2 at 10, ×3 at 25) and juice: hit-stop, sparks, shake.
* **The Zmory.** *Mara* walks, one hit. *Skoczek* leaps in an arc — hit it as it lands. *Widmo*
  flickers, two hits. *Pancerna* wears armour of shadow: strikes bounce until the aura has cracked
  it. *Rój*, a cluster of small shades, breaks into three. The night ends with *Koszmar*, a great
  shadow that attacks from alternating sides in phases.
* **Push — Czuwanie** (vigil): `level` is the **aura**, a circle of light around the angel and the
  bed. Inside it the Zmory slow down and take light damage per second in proportion to how far the
  level stands above the threshold; while the level is above 0.5 the aura cracks armour. `hold`
  charges the **Płomień** (5 s Mendi / 3 s HALO of held focus): at full, a radiant burst banishes every
  Zmora on screen, then the charge starts again. Outside push blocks the aura is a faint candle.
* **Rest — Kołysanka** (lullaby): the Zmory draw back into the dark; the angel sings over the bed.
  `calm` fills the child's dream bubble with stars: it refills **Sen** (the dream light) and pays
  feathers. A passed rest: "spokojny sen", a feather bonus.
* **Grace.** A Zmora reaching the bed dims Sen; when Sen runs out the child stirs, the angel comforts
  it, the Zmory near the bed scatter and Sen comes back to half; only the combo is lost. Nothing ends
  the night early.
* **Levels and gifts.** Feathers banished out of the Zmory are XP; every level-up pauses for a choice
  of one of three gifts for the night (longer reach, a double strike, a wing shield that stops one
  Zmora per wave at the bed, a spear of light that strikes through a line, a wider aura, a faster
  Płomień, a night lamp that keeps a small aura in rest blocks). Across sessions the angel's rank
  (all feathers ever) widens the pool of gifts and makes the room cosier (a star mobile, a night
  light, a book, a blanket with stars); nights grow harder in their mix.
* **Blind — Mgła snu:** every 4th push from the 3rd session the aura is not drawn and does not act;
  at the block's end its last 15 s of focus become a dawn burst of the same strength, all at once.
* **The signal in sight.** The aura's radius (live), the Płomień's ring (hold), a strip of stars along
  the window sill (the history, kit/trace).
* **Headline.** Zmory banished (`zmora/zmory/zmór`). **Closing:** the first night: Matthew 18:10;
  a Płomień: Psalm 34:7; Koszmar banished: John 1:5; many Zmory: Psalm 91:5; Sen never ran out:
  Proverbs 3:24; a long vigil: Psalm 121:4; a passed rest: Psalm 4:8; a new rank: Hebrews 1:14;
  else Psalm 127:2.

### 8.3 Zastępy — the hosts at the two gates (lane battler)

*Revelation 12:7-8 — "Michael and his angels fought against the dragon … but he was not strong
enough."* The gate of light on the left, the gate of ash on the right, one road between them.

* **View and verb.** A side view of one road across a sky of clouds and rock, the gates at both ends
  (the camera pans with a drag; it follows the front by default). Light flows into a bar over time;
  unit cards along the bottom cost light and have a short cooldown; a tap on a card (or 1–5, Space
  = the cheapest ready card) sends that unit out of the gate. Units walk toward the enemy and fight on
  contact by themselves; the battle is won when the gate of ash falls.
* **The host.** Strażnik (sword, cheap), Łucznik (bow of light, ranged), Tarczownik (shield, slow and
  sturdy), Jeździec (on a white horse, fast — Revelation 19:14), Serafin (flies, fire over an area),
  and later Archanioł (a hero with a long cooldown). **The demons** (shadows): Chochlik, Cień, Ogar
  (fast), Bestia (brute), Skrzydlak (flies); the last battle of each circle sends the Smok.
* **Gold and the gate.** Every demon beaten and every battle won pays gold; gold raises the gate of
  light (levels 1–10: walls, light income, a beam that shoots from the gate, more card slots) and the
  units (levels 1–5 each). Battles go in circles of ten, harder each time; a circle's tenth battle is
  the Smok.
* **Push — Natarcie** (the advance): `level` above the threshold speeds the flow of light (up to
  ×2.2 at the top; never below the base flow — no penalty), so a held focus fields a larger host;
  `hold` charges the **Trąba** (trumpet): at full a tap on it (or T) sounds it — a shockwave throws
  the demons back and wounds them.
* **Rest — Cisza** (*Exodus 14:14 — "The LORD will fight for you; you need only to be still."*): the
  demons' waves slow; `calm` mends the gate's walls and lays a shield of light on the front-line units.
* **Grace.** If the gate of light falls, the host withdraws: the gold of the battle is kept, the
  battle starts again with the gate's walls one level stronger for that try. Never an ending.
* **Blind — Mgła bitewna:** the push block's extra light is not shown and not paid while it runs; at
  its end it is paid at once by the block's last 15 s of focus.
* **The signal in sight.** The light stream into the bar (live), the trumpet's ring (hold), a line
  of banners along the road (the history).
* **Headline.** Demons beaten (`demonów`). **Closing:** a battle won: Ephesians 6:10-11; a comeback
  after a withdrawal: Romans 12:21; the Smok beaten: 1 John 4:4; the trumpet: James 4:7; a new gate
  level: 2 Corinthians 10:4; a passed rest: Exodus 14:14; else Revelation 12:7-8.

### 8.4 Firmament — stars in threes (match-3 saga)

*Psalm 147:4 — "He determines the number of the stars; He calls them each by name."* A night sky in
constellations, each a path of levels.

* **Board and verb.** 8×8 cells, six kinds of sky bodies with distinct silhouettes and colours (a
  gold star, a silver crescent, a blue ringed planet, an orange sun, a violet nebula, a green
  meteorite); swap two neighbours (a drag, or a tap and a tap) to line up three or more; an
  invalid swap bounces back for free. Cleared bodies fall and refill from above; cascades multiply.
  Space shows a hint, a second Space plays it (keyboard play and the smoke); arrows and Enter move
  a cursor and swap.
* **Specials.** Four in a line make a Kometa (clears its row or column, by the line's direction);
  an L or a T makes a Supernowa (a 3×3 blast, twice); five in a line make a Pulsar (swapped with a
  body, it clears every body of that kind). Specials swapped together combine (two comets a cross,
  a comet and a supernova three rows and three columns, two supernovae 5×5, a pulsar and a special
  turn every body of a kind into that special, two pulsars the whole board).
* **Levels.** Goals by level: a score; collect N of a kind; clear the stardust (layers on cells,
  cleared by matches on them); break asteroids (blockers, 1–3 hits from neighbouring matches);
  bring satellites down to the bottom row. Moves are limited (15–30); one to three stars by score.
  The first constellations are hand-made; later ones come from a seeded generator, the same level
  for everyone, never starting with a match and always with a move (a reshuffle when none is left).
* **The telescope (push — Obserwacja):** `level` above the threshold gathers light into the lens;
  each full lens (about 8 s of good focus) puts an **instrument** in the tray (at most 3): a comet to
  place, a ray that breaks one body or blocker, gravity (one free swap without a match), a supernova
  to place; a hold of 12 s or more turns the next one into a pulsar. Using one is touch: tap the
  instrument, then the cell. This is the founder's rule: in the hard parts, focusing is what earns
  the tools that finish the level.
* **Rest — Cisza nocy:** `calm` brightens the sky; at each threshold a falling star crosses the
  board and turns a body into a comet (a gift), and the best move glows.
* **Out of moves — Ratunek.** The telescope opens once per attempt: six seconds of the block's own
  state (focus above the threshold in a push block, calm below it in a rest block or a free stretch)
  give five more moves. A second failure starts the level again — no lives, no waiting.
* **Blind — Zachmurzenie:** clouds cover the lens: instruments gathered during the block appear at its
  end.
* **The signal in sight.** The lens filling (live), its rim (hold), a band of the Milky Way across the
  top of the sky (the history).
* **Meta.** The constellation map (saga path), stars per level, a tray that grows to 4 and new
  instruments unlocked by constellation; the day's level (seeded, the same for everyone).
* **Headline.** Points (`pkt`). **Closing:** a constellation complete: Isaiah 40:26; three stars:
  Genesis 15:5; a pulsar: Daniel 12:3; a rescue: Philippians 2:15; a long cascade: Job 38:7; a new
  instrument: 1 Corinthians 15:41; a passed rest: Jeremiah 31:35; else Genesis 1:16, Psalm 19:1.

### 8.5 How they fit the set

| | Anioł Stróż | Zastępy | Firmament |
|---|---|---|---|
| Kind (the Games tab) | arcade | arcade | puzzle |
| Genre core | two-sided tap brawler | lane battler, two bases | match-3 saga |
| Hands | tap left / right | send units, sound the trumpet | swap, place instruments |
| Push block | the aura wounds and cracks armour; Płomień | faster light, the trumpet | the telescope earns instruments |
| Rest block | the lullaby refills the dream | the walls mend, shields | falling stars, the hint |
| Grace | the child is comforted, Sen back to half | the host withdraws, keeps the gold | five more moves for six seconds of focus or calm |

## 9. Three more the founder asked for: Dolina, Chleby, Jerzy i smok

The founder asked for three more games, funny, addictive and told as stories, with the Mendi
reading as the **core** mechanic, not a bonus on top: a runner with hack-and-slash through the eras
of a dark world (the model: Hell Escape — run, fight, evolve, escape; guardians of each era), a crowd
game where a cannon fires a crowd through multiplying gates at an enemy base (Mob Control), and a
roguelite boss fight against dragons to save a princess, with a choice of one of three skills at
every level-up (Knight Survivor). As in §8 each takes the **genre's** core and makes it ours; no
source game's names, numbers, layouts or art.

**The signal is the core.** In each of the three the thing the push block drives is the thing the
game is about: the lamp that lets you see and fight in the valley, the gate that multiplies the
bread, the shield that puts out the dragon's fire. Without the signal each still plays (a small
lamp, a gate of ×1, a small shield — never a penalty), but every good stretch of focus visibly
changes the run, the volley, the fight. Each push block's HUD says what to do in the head and draws
the gauge on the thing it drives (§7.8).

**Funny and told as a story.** Each game has a companion who talks (short lines in a speech
bubble, 2–4 s, never more than one at a time, never during a telegraph), an opening card, a card
between stages and a closing line; the humour is warm and never mocks faith. Lines come from the
game's i18n catalog in all four languages, with several variants per moment so they do not repeat
in a session.

### 9.1 Reverence for these three

* **Dolina.** The valley is the "valley of the shadow" of Psalm 23:4 — never called hell. Its
  creatures are shadows (§8.1): ink, smoke, ember eyes, dissolving into light; the guardians of the
  eras are shadows too, shaped by their age (a tower of bricks, a knight of soot, a screen of
  flickering light). The lamp is the word that lights the path (Psalm 119:105); the light is never
  the player's own power and is never called holy.
* **Chleby.** The feeding of the five thousand is told with joy. Jesus is never shown: He is named
  in the opening card ("Jezus wziął chleby, podziękował i rozdał" — John 6:11); the player plays the
  boy whose basket it was (John 6:9) helping the disciples hand out the bread. No miracle meter: the
  multiplying gates are the game's toy, the story card says whose the miracle was.
* **Jerzy i smok.** The legend of Saint George, told as a story; George is never prayed to or made
  a source of power. The dragon is a beast, not a demon: it is beaten and driven off (it flies away
  over the hills), never killed on screen, no blood. The princess is clever and helps.
* **Exclusive symbols.** The lamp, the valley and the moth to Dolina; the basket, the gates and the
  gulls to Chleby; the shield, the dragon and the princess to Jerzy i smok.

### 9.2 Dolina — the valley of the shadow (runner + hack-and-slash)

*Psalm 23:4 — "Even though I walk through the valley of the shadow of death, I will fear no evil."*
A pilgrim with an oil lamp runs through the valley toward the dawn; each run crosses three eras of
the dark, each ending at its guardian.

* **View and verb.** A side view, auto-run to the right, parallax layers; the pilgrim runs on his
  own. A tap on the right two thirds (or Space, or →) **slashes** ahead with the sword (a short arc,
  0.25 s); a swipe up (↑, W) **jumps**; a swipe down (↓, S) **slides** under a beam; a tap on the left
  third raises the lamp (a short burst of light that stuns the nearest shadow, 3 s cooldown).
  Snappy: coyote time, a jump buffer, hit-stop on a kill, a combo counter.
* **The eras.** *Babel* (clay, bricks, a ziggurat in the dust: shadows of clay, *Glinianek* walks,
  *Cegłomiot* throws bricks), *Twierdza* (a burned castle: *Giermek z sadzy* with a shield that
  breaks on the second hit, *Kruki* that dive), *Miasto* (a city of screens: *Pling* — a
  notification bubble that pops up in front of you, *Przewijacz* that pulls you back unless slashed).
  Pits and beams between them. Each era ends at its **guardian** with telegraphed patterns and a weak
  point: *Wieża* (bricks rain in columns; the glowing seam is open after each volley), *Rycerz
  z sadzy* (a three-hit combo then a heavy blow you jump over; open after the blow), *Ekran* (a giant
  screen that spawns Plings and sweeps a beam you slide under; open while it "loads").
* **The lamp (push — Światło):** `level` is the lamp's **reach**: the light circle ahead of the
  pilgrim (the dark beyond it is drawn as fog; pits and shadows are always faintly outlined, never a
  trap). Inside the light shadows slow down and burn (damage per second in proportion to how far
  above the threshold), and the sword's arc grows. `hold` charges **Świt** (5 s Mendi / 3 s HALO):
  at full the lamp blazes and every shadow on screen dissolves; on a guardian it opens the weak point
  for 3 s. Outside push blocks the lamp is a steady small flame.
* **Rest — Pastwisko** (*Psalm 23:2*): the run slows to a walk across a green meadow by still water;
  no shadows come. `calm` refills the lamp's **oil** (the run's health) and pays sparks; a passed
  rest gives a full flask.
* **Grace.** Hits drain oil; at none the pilgrim falls and gets up (Micah 7:8 on the card) at the
  last lantern post with half oil; the guardian keeps its damage. Nothing ends the run early.
* **Evolve.** Sparks from shadows, guardians and passed blocks buy upgrades between runs (sword,
  lamp reach, oil, boots, the Świt) and new looks for the pilgrim (cloak → traveller → lamplighter →
  keeper of the dawn) — the "evolve" of the genre. A run reaching an era's guardian unlocks starting
  there next time.
* **Companion.** *Ćma* (a moth who loves the lamp a little too much): comments on the eras ("Babel?
  Wszyscy mówią naraz, nikt nie słucha"), warns of a guardian, cheers a Świt, sulks when the lamp is
  small.
* **Blind — Mgła:** the lamp's reach is not drawn and does not act; at the block's end its last 15 s
  of focus become one Świt of the same strength.
* **The signal in sight.** The light circle (live), the Świt ring on the lamp (hold), a line of lit
  and unlit lantern posts along the road behind (the history).
* **Headline.** Metres of the valley (`m`). **Closing:** the first run: Psalm 23:4; a guardian
  beaten: Micah 7:8; a Świt: John 8:12; the dawn gate reached (all three eras): 1 Peter 2:9; a long
  push with a wide lamp: Psalm 119:105; a passed rest: Psalm 23:1-3; else Psalm 139:12.

### 9.3 Chleby — five loaves and two fish (crowd cannon)

*John 6:9 — "Here is a boy with five barley loaves and two small fish. But what difference will
these make among so many?"* The hillside by the lake; the crowd sits in groups on the green grass.

* **View and verb.** A view up a green hillside (portrait: the basket at the bottom, the crowd at
  the top; landscape: the same lane, wider). The boy's basket slides along the bottom: drag to aim,
  hold to pour a stream of loaves and fish up the hill (a tap fires a short volley; Space fires one
  too). The bread rolls and bounces uphill through **gates** that slide across the lane: `+5`, `×2`,
  `×3`, `−4` (green adds, gold multiplies, grey takes away) — the genre's joy of watching a handful
  become a flood. Each piece that reaches a **group** of the hungry (in fifties and hundreds, Mark
  6:39-40, each with a hunger number over its head) feeds one person; a fed group stands, cheers,
  and sits down satisfied.
* **The gulls.** Gulls from the lake swoop across the lane and snatch bread (one gull, one piece;
  a flock in a V; *Mewa Mirka*, their leader, takes five and laughs). Bread that meets a gull knocks
  it off into the water. Levels end with *Pelikan* — a greedy pelican who sits on the path and gulps
  whole streams until his pouch is full (feed him enough and he waddles off, sated and sheepish).
* **Specials.** The **Wielki kosz** (a huge basket on legs that walks uphill, splitting into twenty
  loaves at the top or when it passes a gate) and the fish (fast, they skip over one gate). Upgrades
  between levels: the stream's rate, the start gate, the fish, the big basket's size.
* **The golden gate (push — Rozdawanie):** one gate in
  every lane is gold, and its multiplier is the `level`: ×1 below the threshold (never less — no
  penalty), ×2 at it, up to ×5 at the top, written large on the gate with the threshold drawn on its
  frame. Every volley through it shows the signal working. `hold` fills the **Wielki kosz** (6 s
  Mendi / 3 s HALO of held focus): at full the next shot is a big basket.
* **Rest — Na trawie** (*Mark 6:39-40*): the crowd sits down in neat groups; the gulls settle on the
  water and doze; `calm` gathers the leftover crumbs into baskets (up to twelve per level — Mark
  6:43), each basket worth a bonus; a passed rest: a full basket.
* **Grace.** Nothing is ever lost for good: bread the gulls take returns as crumbs for the baskets,
  a level that runs out of time is finished by the disciples (the remaining groups fed at half
  score) so the story always ends with everyone fed.
* **Levels and story.** A path of hillsides (the lakeshore, the olive grove, the village square…),
  each a level of 3–6 groups with gates and gulls; three stars by bread to spare and baskets; the
  last level of each chapter is a Pelikan. Story cards between chapters (the boy, his mother who
  packed the lunch, the disciples counting).
* **Companion.** *Mirka* the gull is the comedy (taunts, steals, gets knocked into the lake: "To nie
  kradzież, to degustacja!"); the boy answers. Mirka finally gets a loaf of her own at the end.
* **Blind — Mgła nad jeziorem:** the golden gate shows "?" and acts as ×1 while the block runs; at its
  end a volley of the block's last 15 s of focus pours out at once.
* **The signal in sight.** The golden gate's multiplier (live), the big basket filling (hold), a row
  of baskets along the bottom edge lit gold where the signal was above the threshold (the history).
* **Headline.** People fed (`nakarmionych`). **Closing:** the first level: John 6:9; all fed:
  Mark 6:42-43; a big basket: John 6:11; twelve baskets: John 6:12; the Pelikan sated: Matthew 6:26;
  a passed rest: Mark 6:39-40; else John 6:35.

### 9.4 Jerzy i smok — the knight and the dragon (roguelite boss fight)

*Ephesians 6:16 — "Take up the shield of faith, with which you can extinguish all the flaming
arrows of the evil one."* The legend of Saint George: a town held by a dragon, a princess who
refuses to be helpless, a knight with a shield.

* **View and verb.** A top-down arena (a meadow by the dragon's cave; later a marsh, a mountain
  pass, the castle walls). Tap or drag where the knight should go (the smoke's centre click walks
  him toward the dragon); he **strikes by himself** when the dragon is in reach. A swipe (or Space)
  **rolls** — a quick dodge with a short invulnerability. Every strike knocks off a scale.
* **The dragons.** Each has patterns, telegraphed in the arena with red shapes 0.8–1.2 s ahead, and a
  flaw: *Smok Zielony* (fire breath in a cone, a tail sweep; after a breath he coughs smoke for 2 s
  and cannot turn), *Smok Bagienny* (spits arcs of fireballs, dives into the marsh; when he surfaces
  he is dizzy), *Smok Skrzydlaty* (circles and dives at the knight; he lands heavily and is stunned),
  *Smok Trzygłowy* (three heads with their own patterns; beaten head by head). Each fight has 2–3
  phases (the dragon gets angrier, the patterns faster).
* **Skills (the roguelite).** Scales are XP; each level pauses the fight for a choice of one of three
  skills, random from a pool: *Wir* (a spin strike), *Kopia* (a lance thrown every few seconds),
  *Biały koń* (a charge across the arena), *Giermek* (a squire who throws water buckets on fires),
  *Szybki miecz*, *Większa tarcza*, *Odbicie* (quenched fire flies back), *Lżejsza zbroja* (faster
  roll)… Skills stack and level; a run's build ends with the fight. Across fights a few skills
  become permanent (the armoury).
* **The shield (push — Tarcza):** `level` is the shield (Ephesians 6:16's shield of faith, called
  simply *Tarcza* in the game so it never reads as a faith meter): a disc of light in front of the
  knight that turns with him; its size grows with the level above the threshold (a buckler at the
  base — never none). Fire that hits the shield is **put out** (a puff of steam: Ephesians 6:16) and
  every quenched flame charges the **Miecz światła** (the sword of light; Ephesians 6:17 closes a
  fight won with it); a held focus (`hold`, 5 s Mendi /
  3 s HALO) also fills it. At full, the next strike is a great sword of light that breaks a phase's
  armour. Fire that gets past the shield costs heart.
* **Rest — Postój:** the dragon flies to his cave for a nap (snores, smoke rings), the princess
  binds the knight's arm and teases him; `calm` restores heart and fills the princess's **tip**: at
  the end of a passed rest she tells the dragon's next flaw (a hint marked in the arena when it
  opens).
* **Grace.** At no heart the knight is knocked down; the princess throws him an apple, he gets up
  with half heart (the dragon also catches his breath). Nothing ends the fight early; a fight not won
  by the end of the session is continued next time (the dragon keeps its damage).
* **Story.** A map of the kingdom: a town per dragon, each with a short story card and a funny
  princess line; the beaten dragon flies off over the hills (it is driven away, not killed) and the
  town celebrates.
* **Companion.** *Księżniczka Kleodolinda* (the legend's name, which she hates; "mów mi Linda"):
  clever, sarcastic, warm; she warns of patterns she has noticed ("Zawsze zaczyna od lewej łapy!"),
  cheers a quench, mocks the dragon.
* **Blind — Dym:** the shield is drawn as smoke and does not grow while the block runs (the base
  buckler still blocks); at its end the block's last 15 s of focus fill the Miecz światła at once.
* **The signal in sight.** The shield's size (live), the sword's glow (hold), a row of pennants on
  the arena fence lit gold where the signal was above the threshold (the history).
* **Headline.** Scales knocked off (`łusek`). **Closing:** the first fight: Joshua 1:9; a dragon
  driven off: Psalm 91:13; a Miecz światła: Ephesians 6:17; many quenched flames: Ephesians 6:16; a
  long fight: 2 Timothy 4:7; a passed rest: 1 Corinthians 16:13; else Ephesians 6:16.

### 9.5 How they fit the set

| | Dolina | Chleby | Jerzy i smok |
|---|---|---|---|
| Kind (the Games tab) | run | arcade | arcade |
| Genre core | runner + hack-and-slash, eras, guardians | crowd cannon through multiplying gates | roguelite boss fight, 1 of 3 skills |
| Hands | slash, jump, slide, lamp | aim and pour, the big basket | move, roll |
| Push block | the lamp's reach: see, burn, Świt | the golden gate's multiplier, the big basket | the shield puts out fire, Miecz światła |
| Rest block | the meadow refills oil | the crowd sits, the baskets of crumbs | the dragon naps, heart back, a tip |
| Grace | fall and rise at the lantern post | the disciples finish feeding | the princess's apple, half heart |
| Companion | Ćma (moth) | Mirka (gull) | Linda (princess) |

## 10. Version 2: one interface, closer to the originals, the band at the core

On 2026-11-07 the founder played all seventeen games and asked for four things:

1. **One interface for the band, the same in every game, and clear instructions in every game.**
2. **A double jump in Dolina.**
3. **Every game funny, addictive and told as a story, with the Mendi reading as the core mechanic.**
4. **Mechanics closer to the originals each game was modelled on, and better and more engaging play.**

The founder's verdict on each game:

* **Good:** Latarnik, Zastępy and Anioł Stróż. These keep their core and get expanded so they hold
  a player longer.
* **Rebuild:** the other fourteen are boring, or their screen does not say what to do. They get a
  complete redo that takes as much as possible from the original's mechanics. As before, the world,
  the names, the art, the levels and the look stay our own (§5, §8.1).
* **Study the best:** the founder asked to study the mechanics of the world's best games and use
  them. §10.3 is that study, distilled into rules the rebuilds follow.

### 10.1 What "closer to the original" means here

A game's rules, verbs and loop are not anyone's property; its name, characters, art, music, level
layouts and look are. So each rebuild copies the original's mechanics as closely as they serve play:

* the controls and how they feel;
* the obstacle and enemy vocabulary;
* the power-ups, the scoring and combo rules;
* the level and progression structure, the boss pattern, the meta loop.

Each rebuild also does three things:

* it keeps its own world, which is rooted in Scripture (§5);
* it adds the band as the core;
* it drops the original's monetisation pains (lives, energy, paid revives), which become seconds of
  focus or plain grace (§1).

Every builder researches its original first (store page, wiki, reviews, gameplay descriptions) and
writes down the list of mechanics to carry over in its status file before writing code.

### 10.2 The standard HUD: the band reads the same in every game

The runner now draws the band's part of the screen itself (`src/arcade/mendi.ts`), so it looks and
sits the same in all seventeen games. A game only says what goes in it (`kit/types.ts`). The parts,
in order:

1. **The Mendi panel** sits top left, under the time bar. It shows:
   * the block chip (SKUPIENIE / ODPOCZYNEK / NA WYCZUCIE / SWOBODNIE) with the seconds left in the
     block (`signal().left`);
   * "Za chwilę: …" during the telegraph (`signal().next`);
   * the gauge of what the band drives in this game, named by `brain.meter` (`brain.meterRest` in
     rest), with the threshold marked at its middle and gold above it;
   * "W głowie: …", the block's strategy (`signal().task`);
   * the verdict in plain words (good / wait / below; "no signal", never "low").

   The value is the game's own quantity (`meter()`), so the panel shows exactly what moves the play.
2. **The score** sits top right. It shows the headline number and its unit (`headline()`), plus one
   short line under it (a combo, a level, "to the record: 120 m"). It pops when the number grows.
3. **The coach mark** is `env.hint(text, at)`: a bubble that points at a spot on the canvas, one at a
   time, never in the way of a tap. Every game teaches its controls with it in the first session,
   one mechanic at a time and at the moment it first matters.
4. **How to play** (`module.howto()`) covers four things:
   * the goal in one sentence;
   * one to three controls, each with a gesture icon (tap, hold, drag, swipe, steer, keys);
   * what focus and rest drive (from the registry);
   * how the gauge reads.

   It is shown on the calibration card and behind a new **?** button in the top bar, which pauses
   the game.
5. **The block banner** says what to do in the head and what it drives, for about 4 s when a block
   begins.
6. **The dock** under the game keeps the history: the chart, the last block against the one before,
   the session's contrast. The "now" moved into the panel, so the dock is smaller (128 px on
   desktop, 150 px on a phone).

A game keeps its important play below `env.hudTop()`. It must no longer draw its own block card,
its own score corner, or a "W głowie" text. In-world drawings of the signal stay and matter: the
lamp's circle, the shield's ring, the threshold mark on the thing itself. They are the game being
about the band, and the panel names the same quantity in plain words.

### 10.3 What the world's best games do (the toolkit the rebuilds use)

Drawn from the games that define their genres (Super Mario Bros./Run, Celeste, Hollow Knight,
Subway Surfers, Candy Crush and Royal Match, Vampire Survivors and Archero, Hades, Balatro, Tiny
Wings, Clash Royale, Angry Birds, Peggle, Untitled Goose Game, Animal Crossing, Duolingo) and from
the craft writing about them (Swink's *Game Feel*, Vlambeer's "juice", Nintendo's four-step level
design, Csikszentmihalyi's flow, Schell's lenses):

1. **Feel first.**
   * A press answers within a frame: a sound, a squash, a puff.
   * Hits pause the world for 40–90 ms (hit-stop).
   * Big moments shake the screen, scaled down for `reducedMotion`.
   * Numbers fly off what earned them.
   * Pitch climbs with a combo (Candy Crush, Peggle).
   * Silhouettes read at a glance, and every object has a sound.
2. **Forgiving controls.** Platform games add:
   * coyote time (about 0.1 s after leaving a ledge);
   * a jump buffer (a tap up to about 0.12 s before landing counts);
   * variable jump height (hold for higher);
   * a double jump (Celeste, Hollow Knight, Mario);
   * generous hitboxes for pickups and strict ones for hazards.
3. **Three nested loops.**
   * A 10–30 s moment loop: dodge, place, merge.
   * A 1–5 min level or run loop with a clear goal and stars.
   * A days-long meta loop: a map, upgrades, a collection, missions.

   Each loop pays out at its end: a level ends on a tally, and a run ends on "only 120 m to your
   best".
4. **Clear goals per level.**
   * One readable objective ("feed 40", "free 12 pairs").
   * Three-star thresholds (Angry Birds, Candy Crush).
   * Goals that vary from level to level (collect, clear, survive, reach).
5. **A difficulty roller-coaster.** Peaks, then a breather, then a twist (Candy Crush's hard levels
   followed by easy ones, Vampire Survivors' waves). Never a flat ramp.
6. **Meaningful choice.**
   * Pick one of three upgrades, with synergies that change the build (Vampire Survivors, Hades,
     Archero, Balatro).
   * Choices are shown with their effect in numbers.
7. **Power fantasy.** Every run reaches a moment where the player feels huge: a jetpack, a fever, a
   screen-wide special, a champion unit. **In our games the band earns it: the push block's focus is
   what fills the power.**
8. **Combos and multipliers in sight.** A ladder that climbs and resets visibly (Tony Hawk, Balatro's
   chips × mult): the player can see the number they are building.
9. **Onboarding by doing.** No walls of text.
   * Teach one mechanic, let the player use it, twist it, combine it (Nintendo's
     *kishōtenketsu*).
   * Coach marks point at the thing.
   * The first session is the tutorial.
10. **Characters and a story.** A companion with a personality and running jokes reacts to what
    happened, never generically (Hades' dialogue, Goose Game slapstick). Short chapter cards and a
    goal the player cares about (deliver the letters, feed the crowd, save the princess).
11. **Visible progression.**
    * A saga map or a world map.
    * Upgrades between runs (Jetpack Joyride, Hill Climb).
    * Collections with a completion percentage.
    * "New" moments every session.
12. **Bosses with telegraphs.** A wind-up, the attack, then an opening to punish (Cuphead, Hollow
    Knight). Phases that change the pattern.
13. **Ethics stay (§1).**
    * No FOMO timers, no paid randomness, no streak shaming.
    * Losing a run never ends the session: a new run starts, and the score so far is kept.

### 10.4 The band as the core: the pattern library

The brain drives slow quantities (§2). Each game builds its push mechanic from one or two of these
patterns:

| Pattern | Push block (focus above the threshold) | Examples |
|---|---|---|
| **Power charge → super** | held focus fills a power bar; full = the run's best moment (flight, fever, champion, screen-wide special) | Posłaniec's flight, Wzlot's fever, Chleby's champion, Firmament's tools |
| **Reach / radius / sight** | the circle the player acts in grows; outside it things are dark, foggy, out of range | Latarnik's beam, Dolina's lamp, Pasterz's call, Arka's fog |
| **Multiplier** | points per action ×1 … ×5 while focused | Geoda's shine, Chleby's golden gate |
| **Protection** | a shield or aura that grows, quenches, absorbs | Jerzy's shield, Anioł's light |
| **Time** | slows the threat (water, sunset, rising flood), giving room to plan | Źródła's water, Wzlot's sun |
| **Path / building** | focus materialises the route (bridges, high roads, steps) | Zacheusz's rooftop road |

Rest blocks run on their own patterns:

| Pattern | Rest block (calm) |
|---|---|
| **Repair and heal** | hearts, walls, oil |
| **Harvest** | the calm stretch fills baskets and ripens fruit, so it is worth playing gently |
| **Prepare** | upgrades, the choice of a skill, a shop window |

Rules for all of them:

* The push block must produce the **most fun moment of the game**.
* It must be visible within one lag (≈5 s Mendi, ≈1 s HALO) of crossing the threshold.
* It is drawn on the thing itself with the threshold mark, and named in the panel by
  `brain.meter`.
* Without the signal the game plays at its base: never a penalty (§2.4).

### 10.5 Each game's direction

| Game | Original | Carry over (mechanics) | Push → | Rest → |
|---|---|---|---|---|
| Posłaniec | Subway Surfers | three lanes; swipe ←/→, ↑ jump, ↓ roll; static and oncoming carts, high and low barriers, ramps onto roofs; coin lines; power-ups (magnet, high-jump sandals, ×2, a shield board); a chaser that catches up after a stumble; missions that raise a permanent multiplier; a daily word hunt | **wings**: held focus fills the flight; full = a flight over the roofs along a coin trail | quiet road; calm lights the watchtowers, which give a shield |
| Zacheusz | Super Mario Run | auto-run; tap to jump, hold for higher; vault over small things, bounce off creatures; wall-jump; pause and arrow blocks; five special coins per level in three tiers; a finish pole for points; a bubble retry; stylish moves score; worlds of hand-made levels | **path**: focus builds the rooftop high road (planks of light appear ahead) and shows the special coins | figs ripen into bonus coins and bubbles |
| Pasterz | Crowd City | steer the leader; neutral sheep join on touch; rival flocks of other shepherds roam; a bigger flock wins a smaller one's sheep on contact; rounds of ~2 min with a live ranking; a crown for first | **reach**: the call ring's radius | the night watch: the flock beds down, stars count the sheep |
| Geoda | Block Blast | 8×8 board; three pieces; drag to place; rows and columns clear; a combo streak; a board-clear bonus; no fit = the geode turns (score kept) | **multiplier**: shine ×1…×5 on clears, crystals grow on cleared cells | Szlif: calm polishes the best gem |
| Urodzaj | Suika Game | drop from a mover; physics merge of equal fruits up a ladder of tiers; next preview; chain merges; overflow line = the basket is gathered, a new one starts | **charge**: focus fills the harvest wind, a shake that settles the basket and merges neighbours | gleaners: calm gathers the fallen into the table |
| Wzlot | Tiny Wings | hold to dive, release to rise; a perfect slide is a dive down and a release on the upslope; three perfect slides = fever; islands; the sunset chases | **time**: focus holds the sun up (the night comes slower); held focus = fever | thermals: calm lifts the eaglet |
| Arka | Arrows – Puzzle Escape | tap a piece and it slides off in its arrow's direction if the way is clear; three bumps per level; boards grow; a level saga with stars | **sight**: the flood's mist covers far pieces; focus clears the mist so you see their arrows | the rainbow: calm restores a bump and shows one safe move |
| Motylarnia | Snake / Slither.io | steer a caterpillar that grows with every leaf; its own body is the obstacle; birds roam; boost; moult at lengths | **reach**: focus is appetite (a pull radius on food, a free boost) | the chrysalis: calm deepens the butterfly's colours |
| Glina | Let's Create! Pottery | shape by drag on the spinning wheel; orders with a silhouette and a % match; kiln firing on timing; glazes and patterns; a shop with customers who react | **steadiness**: focus calms the wobble and draws the master's guide line | the kiln: calm keeps the heat even |
| Źródła | Pipe Mania / water connect | the water starts after a countdown; lay and rotate pipes ahead of it; a longer path scores more; reservoirs and crossings; level goals | **time**: focus lowers the water's pressure (it flows slower) | the valley greens: calm grows the gardens the water reached |
| Firmament | Candy Crush | saga map; goals (score, dark clouds to clear, moons to bring down, ice); limited moves; three stars; striped, wrapped and colour-bomb specials and their combos; the end-of-level cascade | **charge**: focus fills the telescope's tools | a calm sky: falling stars refill |
| Dolina | Hell Escape | run, slash and dodge through eras with guardians; evolve between runs; **double jump** (new) | **sight**: the lamp's reach | the meadow refills the oil |
| Chleby | Mob Control | hold to pour from a cannon, drag to aim; moving ×/+/− gates; crowds run up to the targets; enemy waves come down; a champion when the bar fills; cannon and unit upgrades; levels with boss bases | **multiplier and charge**: the golden gate, the big basket (the champion) | the crowd sits down, the baskets of crumbs fill |
| Jerzy | Knight Survivor | joystick move; auto attacks; gems for experience; pick one of three skills at a level-up; weapon evolutions; waves; dragon bosses with telegraphs | **protection**: the shield's aura grows, quenches fire and pushes back | the dragon naps: hearts back, a skill choice |
| Latarnik | (keeps) one-tap timing | expand: nights with goals and stars, new boat kinds (fog, storm, convoy, whale), lighthouse upgrades, a talking companion, storm "bosses" | reach (keeps) | sea glow, amber (keeps) |
| Zastępy | (keeps) We Are Warriors | expand: more units and upgrades, ages of the fortress, a hero power, boss gates, a campaign map | (keeps) | (keeps) |
| Anioł Stróż | (keeps) Endless Puncher | expand: more nightmare kinds, combos, an upgrade tree, nights as chapters, boss nightmares | (keeps) | (keeps) |

Each rebuild writes its own detailed design into its section of this file (§7–§9). It updates the
existing section in place and does not add a new one.
