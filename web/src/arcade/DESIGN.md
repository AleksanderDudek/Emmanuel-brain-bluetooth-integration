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
  angels to command, no demons, no occult or New Age frames, no prosperity promises. Each Bible symbol
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
