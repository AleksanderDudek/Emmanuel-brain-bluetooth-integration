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

### 3.1 Geoda, version 2 (2026-11-07): Block Blast in a geode

The founder found the first Geoda boring (the pieces grew by themselves and the board only cleared
at the end of a block), so it was rebuilt as close to **Block Blast!** (Hungry Studio) as serves
play. The table above records the first design; this is the one that ships.

**Carried over from Block Blast:**
* the 8×8 board;
* three pieces in the tray, with a new three only when all three are placed;
* no rotation, and every orientation is its own piece (lines of 1–5, 2×2, 3×3, 2×3, the small L,
  L4, the big corner, T, S/Z);
* the drag: the piece lifts above the finger at board size, a ghost shows where it snaps, and
  the rows and columns it would clear light up in its colour;
* full rows AND columns clear at once;
* scoring: a point per cell placed, then 10·L·(L+1)/2 for L lines at once;
* the combo: it grows while a clear comes within three placements, multiplies a clear by
  1 + 0.5·(combo − 1), climbs in pitch and says "Combo ×n";
* praise words for 2, 3, 4 and 5 lines;
* a clean-board bonus;
* the fair dealer: a triple is drawn until all three can be placed in some order, and pieces that
  finish a line right now are 2.2× likelier;
* the adventure mode (**Wyprawa**): chambers whose rock holds jewels (sapphire, ruby, emerald,
  topaz: Isaiah 54:11-12's stones) that are collected by clearing their line, a goal counter,
  1–3 stars by points, and a map;
* the classic endless board (**Klasyka**), chosen in the lobby, with its own board record.

**Adapted:** no fit is no game over. The geode turns: the board's tally (with "N ct to the board
record" in the Klasyka), the points kept, and a fresh board (a turned chamber keeps half its
rock and the jewels still wanted). A tap on the board without a drag, or Space, places the
current piece at the best spot (the auto-place helper: it also makes the smoke input score).
After 2.5 s idle a dotted ghost shows that spot.

**Dropped:** ads, revives and the coin shop.

**The band:**
* **Blask (push):** the shine dial follows `level` after the band's delay (5 s Mendi, 2 s HALO).
  It is ×1 below 0.25, ×2 below the threshold, and ×3 from the threshold (the dial's gold notch),
  up to ×4 and ×5. The multiplier pays every clear, the clean bonus and the harvest. Above the
  threshold, druses (gold crystal points) grow on cleared, still-empty cells, and a piece set over
  them harvests up to 10 ct a cell × the shine. The crystals turn brilliant at ×4 and more, and a
  light sweeps the board. The meter is the dial, 0.5 at the threshold.
* **Ciemna komora (blind push):** every 4th push from the 3rd session. The dial is hidden, and
  clears go into a sack that is paid at the block's end × (1 + 4 × the judged share).
* **Szlif (rest):** the push block's best clear becomes the round's gem in the bowl (a mineral
  the cabinet is missing first, so the set always completes). Calm polishes it, and the panel's
  gauge shows the calm. A passed rest (RoundJudge) or a full polish lifts it a tier on its way to
  the cabinet (nine minerals × four tiers). It pays its base × (1 + polish). The dealer gives
  gentler pieces in a rest. Without a signal the gem still comes, with no lift and no loss.
* Each block is judged once at its end. `BlockContrast` feeds the summary. A blind push's veil
  lifts at its end. The band's last 40 s stand as crystal points on the geode's foot.

**Bazyl** is a short-sighted mole jeweller in a miner's helmet with a lamp, thick round glasses
and a loupe. His running jokes are his eyesight, his granny's sayings and his pantry. He has
three or more lines for each moment (the opening, the warm-up, a push, a blind push, a rest, the
dial staying gold, a stuck piece, a big clear, a combo, a clean board, a turn, a chamber won, a
polished gem, a jewel, a harvest, the end). He stays quiet under the banner, a telegraph and a
card. His lamp burns brighter with the shine.

**The story:** a first-session card tells of the old mine and the geode, with the root verse.
Each chamber has a name and one sentence on its card, and the summary closes with a line from
Bazyl.

**The first session teaches with coach marks:** drag, then the tap helper, a line, the goal and
the jewel, the dial (after the banner), the druses, the Szlif's bowl. Later sessions explain only
what is new to the player (a blind push, a stuck piece, a combo).

**The meta:** the Wyprawa's chambers with their stars, the cabinet, the board record, and the
session record.

**Old saves:** a version-1 save keeps its best and its session count, and the rest starts over
(`meta.ts` `migrate`).

### 3.2 Latarnik, version 2 (2026-11-07): nights of a one-tap timing game

The founder called Latarnik good and asked for more to hold a player. Its core stays: the turning
beam, one tap when it lies on a boat, the reach that focus stretches, the glowing Cisza with its
amber, the Baltic night and its look. Around it come the level structure, the boss and the meta
of the one-tap timing hits (Pop the Lock, Knife Hit, Stack).

**The originals, and what happened to them:**

| One-tap timing games | Latarnik |
|---|---|
| one input: tap while a moving marker is on a target | carried over (the core): tap while the beam lies on a boat; Space or Enter too |
| a lock or a log is a level: N targets, a counter to zero | adapted: every **night** has one goal with a counter (the goal chip, and "Noc 3 · 4/8" under the runner's score) |
| speed rises level by level; Pop the Lock reverses on a hit | adapted: the beam turns 3°/s faster each night (104° → 136°/s); the squall reverses it |
| a boss every fifth stage, with erratic, stop-and-go rotation (Knife Hit) | carried over: every fifth night is a **Szkwał**: gusts telegraphed 1.6 s ahead (wind streaks, the title, a rising whoosh) that for 2 s throw the beam to 2.1× speed or back the other way and push the boats aside; its goal chip shows the squall's strength emptying boat by boat |
| apples on the log: optional bonus targets | adapted: the whale (bubbles, then 2.8 s surfaced: a flash on it is +6 crates, a dive costs nothing), Hania's bottle, the tall ship |
| knives already stuck in the log | adapted: the flotilla's order (a boat out of turn only waits, "Najpierw 1", no cost) |
| a miss ends the run | dropped: three lanterns a night; when they are out the night starts again, its count kept (★★ is gone, nothing else) |
| perfects in a row climb in pitch (Stack) | carried over: the perfect ladder, the bell a pentatonic step higher each time; 5 in a row is the night's third star, 8 is Pełne światło (a 360° flash) |
| three stars a level | carried over: ★ the goal, ★★ at most one lantern out, ★★★ five perfects in a row, shown live on the goal chip |
| unlockables from apples and bosses | adapted: the workshop (lens, oil, bell, a second beam) bought with crates; the village lit by stars; the amber album kept |
| ads, VIP, revives | dropped |

**The nights** (`nights.ts`) come in runs of five, each run harder: **Powroty** (guide 6, 8, 10…
boats home), **Mgła** (find 3+ fog-bound boats: dark until the beam passes over them within its
reach, then seen for 2.2 s; a mist puff hints where they are, the bell rings there), **Flotylla**
(bring 2+ flotillas in by their numbers: three slow boats at once, their badges shuffled around the
sea, the one whose turn it is glows gold), **Na ratunek** (find pan Edek's rowboat: dark, drifting
sideways; it bumps the reef at no cost and rows back out), **Szkwał** (the boss). The whale may
surface from the third night on. A night won shows its stars and the next night's name, goal and
one sentence of story on a card for 3.2 s; then the next night begins at once.

**The band.**
* **Konwój (push): reach.** As before: reach = 0.42 R + 0.58 R × L after the band's delay (5 s
  fNIRS, 2 s EEG), the steadiness bonus, far boats carrying three crates, the tall ship after 12 s
  of hold. New: the **threshold is drawn on the sea**, a dashed ring at 0.71 R with ticks that turn
  gold once the reach passes it, labelled "próg"; and fog-bound boats and the rowboat are found
  sooner the farther the light reaches. The panel's gauge (*Zasięg światła*) is the reach, 0.5 at
  the threshold. Blind Konwój as before: no ring, no gauge, the far ships counted at its end.
* **Cisza (rest): the glow.** As before: calm spreads the glow from the shore and it reveals amber
  for the album; the gauge (*Blask morza*) is the glow. A Konwój won still gives a lantern back
  and five crates ("Blask latarni").
* Without a signal the reach holds and boats wait (fog), never a loss.

**Zośka**, a herring gull on a mooring post (bottom left; on a phone, under the sea, her bubble
taking the goal chip's place), is the lighthouse's self-appointed bosun. Running jokes: sprats
from pan Edek's smokehouse, counting on her wings, pan Edek getting lost "again", the whale as a
very large sprat. Three lines a moment for 24 moments (the opening, each block, the reach passing
the threshold, a near miss, five perfects, Pełne światło, a lantern out, a night again, a new
night, a night won, three stars, the squall, a fog-bound boat, a flotilla, a boat out of turn, a
rescue, a bump, the whale, a bottle, an upgrade, the dawn). She keeps quiet under the runner's
banner, a telegraph, a gust's warning and the cards, and has the summary's last word.

**The story.** The first-ever session opens with a card (the new keeper, the village, Zośka, and
Matthew 5:14-16), a tap closes it. Each night's card carries one sentence. Closing passages: a
rescue Matthew 14:31; a squall weathered or a Cisza won Mark 4:39; boats home Psalm 107:29-30 and
Isaiah 43:2; Psalm 119:105 for every night.

**The first session teaches with coach marks:** the beam waits on the first boat ("tap now"),
then the perfect ladder, the goal chip, the lanterns (at the first reef), the reach ring (after the
Konwój's banner), the glow (in the Cisza). Later sessions explain only what is new: the fog, the
flotilla, the rescue, the squall's gust, the whale, the workshop.

**The meta:** the map of nights with their stars (the lobby card), the village's eight steps lit at
1, 3, 6, 10, 14, 19, 24 and 30 stars, the workshop (the player picks in the lobby what the crates
go to: lens +1° wedge and +0.5° perfect per level, oil −0.12 s recharge, bell +1.1 s seen and the
ring, the second beam opposite at 62 % of the reach), the amber album and Hania's letters (kept),
"Noc dnia" (kept: on the day's first session the scheduled boats come from the date, their bearings
from an evenly turning beam so the squall and the night's speed do not change them).

**Old saves:** a version-1 save (`v: 1`) keeps its best, sessions, boats, records, amber, letters
and the blind schedule; its crate pile becomes up to 120 crates of workshop credit; the nights
start at the first, and a returning keeper is not taught the tap again (`meta.ts` `migrate`).

### 3.3 Motylarnia, version 2 (2026-11-07): Slither in a garden

The founder found the leaf and the egg cards boring, so Motylarnia became a Snake / Slither.io game.
The world, the butterflies, the atlas and the root passage (2 Corinthians 5:17) stay.

**The original's mechanics, and what happened to them:**

| Snake / Slither.io / Snake.io | Motylarnia |
|---|---|
| the snake always moves and turns toward the pointer at a limited rate; the head stays at the screen's centre | carried over: the caterpillar crawls by itself and turns toward where you point, tap or drag (a hovering mouse steers too); ←/→ turn it; the camera follows the head and zooms out as it grows |
| hold to boost; the boost costs mass, dropped as a trail of pellets | carried over: hold the finger or Space to sprint; the sprint drops tail crumbs that can be eaten back, and costs nothing above the threshold in a push block |
| pellets everywhere, big glowing ones; growth = eating | leaves (small), flowers in the five pigments (bigger, they colour the wings), dew in a siesta, one rare flower per garden that needs it |
| your head on another snake's body = death; theirs on yours = their death, their mass becomes food | adapted: your head on a rival's body is a **stumble** (it curls up, ~20 % of the tail falls as crumbs, 1.6 s untouchable, play goes on); a rival whose head hits your body curls up into crumbs, for points |
| classic Snake: your own body kills | adapted: your own far body is a stumble |
| the map's edge kills | adapted: the hedge turns the head back in |
| leaderboard, online rivals | dropped; AI rival caterpillars, garden stars and "N pts short of the record" instead |
| Snake.io's boss snake and events | adapted as hungry thrushes: a shadow telegraphs the dive (1.4 s), the peck is a stumble, a near miss is cheered |
| ads, revives, paid skins | dropped; the skins are the species' larvae from the atlas |

**The loops.** The moment: eat, chain bites within a second for ×2…×5 (the pitch climbs), dodge a
shadow, block a rival. The level: a garden with a length goal (★), at most one stumble (★★) and a
side goal (★★★: the rare flower, rivals curled on your side, dewdrops, flowers); reaching the length
spins a chrysalis (a short cutscene), a new caterpillar hatches from the next egg and the next
garden's card shows its goals. Eight gardens make the map; after them it loops, each lap longer.
The meta: the map with its stars, the record, the longest caterpillar, and the atlas of 18 Polish
butterflies (eggs, published odds with pity, pyłek, aberrations) kept from version 1.

**The band.**
* **Push (Apetyt): reach.** The circle round the head is the reach: its radius is the base plus the
  focus level, after a 5 s lead-in (2 s on HALO). A dotted ring marks the threshold, the rim turns
  gold beyond it, and the food inside drifts into the mouth: the vacuum is the game's best moment.
  Above the threshold the sprint is free and leaves a golden trail. The panel's gauge (*Apetyt*) is
  the reach. In a blind push block the circle stays at its base, and a passed block ends in a
  feast of flowers round the head.
* **Rest (Sjesta): the chrysalis.** The birds roost, rivals slow down, dew falls, and calm deepens
  the colours of the chrysalises waiting on the twig (or of the caterpillar, which carries them into
  its chrysalis). They hatch at the siesta's end; a passed siesta and deep colours make the
  butterfly radiant, deeper colours make it bigger. A bad signal never pales a chrysalis (a floor).
  The gauge (*Barwy*) is the calm.
* **History in the world:** the flowerbed along the bottom keeps the last 40 s, one flower a
  second: its height the level, gold above the threshold, a cool band behind a siesta, bare dotted
  soil where the signal failed, mist over a blind block, the delay bracketed at "now".

**The path becomes the wing.** The head's path through the garden (with the reach as the stroke's
width) is mapped onto the species' leaf box and stored with the butterfly, so every butterfly's
wings carry the route of the caterpillar that became it, in the colours of the flowers it ate.

**Hieronim**, an old garden snail, comments in short bubbles: proud of his paid-off house, afraid of
the thrush, slow on principle ("I speed up once a week"). He has three or more lines for the
opening, each block, a good push, a near miss, a stumble, his own tail, a curled rival, the goal, a
hatching, the rare flower, a bird, a moult, a sprint, a new garden and the ending. An opening card
(the first time) tells the story with the root verse; the summary ends on one of his lines.

**The first session teaches with coach marks:** steer, eat a flower, sprint, a rival, a bird's
shadow, the appetite circle (after the banner), the twig in the siesta. Later sessions explain only
what is new (the rare flower, a bird or a rival the first time).

**Old saves:** a version-1 save keeps its best, its session count and the collection; the garden
map starts at the first garden and the controls are taught again (`meta.ts` `migrate`).

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
| Geoda | Isaiah 54:11-12 | the cabinet complete: Revelation 21:19-20; a rare gem: Matthew 13:45-46; a polished Szlif: Malachi 3:3; a chamber won: 1 Peter 2:5; else Psalm 127:1, Matthew 7:24-25, 1 Peter 2:5 |
| Latarnik | Matthew 5:14-16 | a rescue: Matthew 14:31; a calm won or a squall weathered: Mark 4:39; boats home: Psalm 107:29-30, Isaiah 43:2; Psalm 119:105 |
| Motylarnia | 2 Corinthians 5:17 | the atlas complete: Revelation 21:5; a new species: Psalm 104:24; a deep chrysalis: Ecclesiastes 3:1; Matthew 6:28-29, 6:26 |
| Arka | Genesis 8:1 | the dove's leaf: Genesis 8:11; a new kind: Genesis 8:17; Genesis 9:13, Psalm 36:6, Lamentations 3:22-23 |
| Urodzaj | Deuteronomy 8:10 | the great cluster or the pole: Psalm 65:11; a new fruit: Deuteronomy 8:8, Psalm 65:11; a feast celebrated: Luke 14:13-14; the gleaners' day: Ruth 2:16, Leviticus 19:9, John 6:12; the day's basket: Matthew 6:11; Psalm 126:5, 2 Corinthians 9:7, Deuteronomy 8:10 |
| Wzlot | Deuteronomy 32:11 | a catch: Psalm 91:4; a high climb: Isaiah 40:31; new plumage: Psalm 103:5; Exodus 19:4 |
| Glina | Jeremiah 18:6 | a household's story complete: Numbers 6:24-26; a master's spin: Jeremiah 18:4; the kiln's gift (a calm fire): Psalm 37:7; a new piece on the shelf: Isaiah 61:3; 2 Corinthians 4:7, Colossians 3:23 |
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

**Arka, version 2 (2026-11-07): Arrows – Puzzle Escape on the ark's deck.** The founder found the
landing-and-planks Arka boring, so it was rebuilt on the arrows escape loop (Lessmore's *Arrows –
Puzzle Escape*, Arrow Puzzle, Amaze GO!), copied as closely as it serves play (the table's column
above is the first design; this paragraph replaces it):

* **The deck (Arrows).** A grid packed with animals, each facing one way; a cream chevron at the
  leader's nose is the arrow. A tap sends it: if every cell ahead of it to the edge is free it slides
  out with a whoosh (15 cells/s), walks down the gangway to the new land and waits there for its
  mate; if not, it runs into the one in its way and springs back — a **bump** costs one of three
  hearts (the same animal tapped again within 1.4 s costs nothing). No hearts left: Noah leads
  everyone back and the deck starts again; the pairs already out stay counted (no lives, no loss).
  Arrows' bent "snake" arrows are **files**: a mother with her young on a straw rope, following her
  path. The clones' specials: a **sleeper** (the first tap wakes it), a **turning goat** (a quarter
  clockwise whenever another animal leaves), a **pen** that opens when the animal carrying its key
  has left. Keys: arrows move a cursor, Enter sends.
* **Boards** (`board.ts`) are generated backwards, so each is solvable: every new animal gets a way
  out clear of those placed before it, and later ones are dropped into earlier ones' ways (about
  half the deck starts blocked); a forward solver proves the board with its goats and pens (stuck
  goats look round by themselves). The saga grows from 3×4 to 9×11 by level ~24, files from level 4,
  sleepers 5, goats 8, pens 11; every fifth level is a big deck and the next a breather.
* **Pairs and stars.** Two of every kind walk a deck; the second down completes a pair (the
  headline, "par"). Mates sent back to back: "Parami!" (the pair bonus). A clean streak climbs the
  bell's pitch. ★★★ = no bump, no dove and within par (8 s + 2.4 s an animal); ★★ = one bump; ★.
* **The dove** is the original's hint: Space or the dove's button shows a free animal (a waiting
  mate's first) and sends it, then rests 4 s; a deck it helped tops out at ★★.
* **Mgła (push: sight).** The flood's mist covers the deck beyond a clear circle around the door;
  past the lead-in its radius is the level (30 % to 106 % of the far corner), the threshold a
  dashed gold ring drawn on the deck ("próg"); a blind block holds it at the threshold and tells its
  share at the end. Above the threshold the free animals inside the circle show their way out in
  golden hoof-prints — focus is *seeing the free one*, the genre's whole skill. Without signal the
  circle holds at the threshold.
* **Tęcza (rest: repair).** Calm paints the rainbow over the deck band by band (~9 s at deep calm);
  full, it gives a heart back (a fourth, rainbow-coloured, when all three are there) and its end
  lights one safe move. A passed rest, or the first rest ever, never ends without one.
* **The raven** (Gen 8:7), "an expert on directions", talks in bubbles (3–5 lines per moment, 16
  moments) and is always cheerfully wrong; the dove helps without a word. Cards: the opening (Gen
  8:1), six chapters after Genesis 8 then the new land, a level card, the stars card; a closing line
  in the summary.
* **Meta.** The saga (level, best stars per level, chips in the lobby), the homestead raised by the
  stars, an olive tree per chapter, "Nowa ziemia" (every pair settles in its kind's valley, young
  after three), records. Closing passages: a restart → Lamentations 3:22-23; a new kind → Genesis
  8:17; a rainbow → Genesis 9:13 / Psalm 36:6; the dove → Genesis 8:11. An old save keeps its best
  session and session count (`migrate`, `ver: 2`).

**Urodzaj, version 2 (2026-11-07): Suika Game in Boaz's field.** The founder found the mosaic version
boring and unclear, so it was rebuilt on Suika Game's loop, copied as closely as it serves play
(the table's column above is the first design; this paragraph replaces it):

* **The basket (Suika).** Feliks the sparrow carries the next fruit along a twine over a wicker
  basket; a drag, a hovering mouse or ← → move him, a release, a tap or Space drops the fruit
  straight down along a dotted guide (0.5 s cooldown, a buffered drop). Real circle physics
  (`physics.ts`: 1/120 s steps, 8 iterations, friction cone, rolling, sleeping) piles, rolls and
  shoves. Two alike fruit that touch join into the next of **eleven** — olive, grape, date, fig,
  apricot, apple, pomegranate, quince, melon, watermelon, the great cluster of Eshcol (Numbers
  13:23), in Suika's proportions — and score Suika's triangular ladder (3, 6, 10 … 66), times a chain
  multiplier (×1.25 a link, up to ×3) when merges cascade. Only the five smallest are dropped; the
  next one shows in its bubble; the circle of fruits is drawn beside the basket. Two great clusters
  leave on the pole (+100). Juice: squash on landing and merging, pop rings, particles, flying
  points, hit-stop on big merges, a pluck that climbs with the chain.
* **The rim is Suika's top line.** A settled fruit over it for 2 s ends the *basket*, never the
  session: a tally with up to three stars (120 / 350 / 800 pts) and the near miss ("29 pkt do
  gwiazdki"), the basket slides to the village table, a new one slides in; every point stays.
* **Wiatr żniwny (push: charge).** Past the lead-in (5 s Mendi, 2 s HALO) the wind's strength
  follows the level; the rim is its gauge, with a wheat ear standing on its middle as the threshold
  and gold beyond it (the panel's "Wiatr" is the same number). Above 0.4 it fills the charge — golden
  light rising in the basket's weave, ~9 s at a strong focus. Full, the harvest wind blows: a
  wind-up, a 1.3 s sway that settles the heap (less friction and gravity), then alike neighbours
  within 0.9 of their radius are drawn together by golden tendrils and merge (up to six pairs) —
  the game's big moment. A passed block adds 0.35 charge. Blind (every 4th push from the 3rd
  session): a linen veil over the gauge, the charge builds unseen, and at the block's end the veil
  lifts and what it gathered blows at once.
* **Pokłosie (rest: harvest).** Ruth and a gleaner stand at the basket's foot; calm fills their
  step (a cool ring over their basket; the panel's "Żniwiarki"), and each full step takes the
  smallest fruit (olive to date) off the heap to the table: room, and twice its points. A passed
  rest: two more. Without signal the wind, the charge and the gleaners freeze.
* **The wheat along the ground** keeps the band's last 40 s (one stalk per bar, gold ears above
  the threshold, cool behind rest, dotted gaps without signal, a veil over a blind block).
* **Feliks** talks (three lines per moment, 19 moments: block starts, the wind rising, a near miss,
  a save, a big fruit, a new fruit, chains, gleaning, the pole, a feast, the end, idling). His
  running jokes: he is a "professional harvester, third generation", heavy fruit is beyond him,
  the olive keeps staring at him.
* **Story.** The first session opens on a card (Boaz's field, Feliks volunteers, Deuteronomy 8:10);
  the tally card between baskets; a feast card; a closing line in the summary.
* **Meta.** The circle of fruits (each tier lit once made: the "new fruit" moment); the feasts of
  Exodus 23:16 in turn — first fruits, harvest, ingathering, twice, the second year harder — each
  with three touch-only missions (a fruit made, a basket's score, a chain, stars, merges, points),
  each setting one decoration on the village table (cloth, loaves, oil, a wreath, lamps, a sheaf);
  Kosz dnia (the day's first session drops the same fruit for everyone); records. A first session
  warms up with coach marks (aim, drop, the next fruit, the first merge, the circle, the rim, the
  wind, the gleaners), and its first four drops pair up so the first merge comes at once.
* **Kept from version 1:** the root (Deuteronomy 8:10), the physics solver (walls made straight, the
  wind's sway and the pole added), Ruth's gleaners, the table; an old save keeps its best day and
  session count (`migrate`, `ver: 2`).

**Wzlot, version 2 (2026-11-07): Tiny Wings over the wilderness.** The founder found the first
Wzlot boring (the band only widened the wings, and nothing chased the eaglet), so it was rebuilt
on Tiny Wings' loop, copied as closely as it serves play (the table's column above is the first
design; this paragraph replaces it):

* **The verb (Tiny Wings).** Hold anywhere (or Space, ↓) and the eaglet gets heavy: it hugs the
  slope, dives and gathers speed; let go and it is light and launches off the crest by its own
  momentum. A tap is a short hold (0.12 s). Landing along a downslope and launching from the next
  crest is a **perfect slide** (+50, +10 a link up to 100); three in a row light the **Poryw**
  (the fever: +15 % speed at once, a higher cap, less drag, a golden trail, every point ×2) until a
  landing that is not smooth. Landing into an upslope is a **bump** (speed ×0.55, a short stun,
  the chain gone). A dive close above a downslope flares onto it, so the rhythm is forgiving.
* **The granie (Tiny Wings' islands).** Smooth cosine hills, seeded by the day: the same for
  everyone today and for every run of the day, so the course can be learnt. Each grań has more
  hills, longer waves and deeper valleys than the last, then a long run-up and a crag (a flag
  marks it) over a gorge to the next: the leap scores +100, the mother eagle catches an eaglet
  that cannot make it and carries it over (grace, Psalm 91:4). On every grań: strings of
  **promyki** (sunbeams, the coins: +5, a rising bell with a streak) along downslopes and in arcs
  over crests, a **podmuch** (the gust orb: speed ×1.25), and the cloud deck high above (+30).
* **The night chases (Tiny Wings' sunset).** The sun sinks along an arc across the sky; the night
  creeps in from the left as daylight runs out. Each grań reached gives daylight back (+8 s for the
  first, a second less for each next, + up to 4 s for a quick one) and +250. When the night
  catches the eaglet it dozes off, the mother carries it home, and the **day's tally** shows (points
  counting up, the farthest grań, perfect slides, promyki, the Poryw, "12 pkt do rekordu dnia");
  then a new day dawns over the same granie ("Dotknij, by wzeszło słońce"). Points: 1 per 4 m,
  20 a second of air on landing, and the bonuses, × the nest's multiplier, × 2 in a Poryw. The
  session's score is all its days together; the session never ends early, and its last seconds
  bring the last sunset.
* **Słońce w górze (push: time).** Past the lead-in (5 s Mendi, 2 s HALO) the smoothed level holds
  the sun up: the night comes at 1 − 0.5 × clamp(2L − 1) of its pace. Drawn on the sun itself: its
  halo's radius is the gauge (the panel's "Słońce w górze"), a dotted ring marks the threshold, the
  rim turns gold above it. **A held focus lights the Poryw**: each focused second fills a charge
  ring around the sun (10 s Mendi, 7 s HALO); full, a Poryw of the band, safe from bumps for 8 s —
  the run's power moment. A passed push gives 4 s of daylight and +100. Blind (every 4th push from
  the 3rd session): a cloud covers the sun, the effect is the same, the charge waits, and at the
  end "W chmurze słońce stało 9 s".
* **Ciepłe powietrze (rest: thermals).** Calm builds the thermals' strength T (the panel's gauge);
  warm columns rise over the valleys ahead every 5.5 s, and an eaglet with open wings climbs them
  ((0.6 + 1.4 T) sh/s for 1–1.6 s): clouds, long glides, the next grań sooner. A passed rest
  starts the next one warm. Without signal nothing brain-driven moves: the night comes at its base
  pace and T holds.
* **The history in the world:** the sun's arc keeps the day — gold where focus held the sun up,
  cool where the day ran through a rest, faint where neither.
* **Leon the lark** talks (19 moments, 3–4 lines each, in four languages): a self-appointed flight
  instructor with "forty years of experience, in lark years", afraid of the dark, who counts "one,
  two, four" and writes to his aunt in Jericho. The mother eagle never talks; she catches and
  carries.
* **Story.** The first session opens on a card (the mother stirs up her nest, Deuteronomy 32:11);
  each dawn is a card ("Dzień 2"), each night the tally; a closing line from Leon in the summary.
  Closing passages: a nest grown — Psalm 103:5; a catch — Psalm 91:4; a long Poryw or a thermal —
  Isaiah 40:31; two days or more — Lamentations 3:22-23; Exodus 19:4.
* **Meta (Tiny Wings' nest).** "Lekcje lotu": three lessons at a time (5 perfect slides in a day,
  100 promyki in all, reach grań 2 …; eight written sets, then sets that grow), mostly touch, a
  band lesson now and then. A full set grows the nest (its level is the points' multiplier, ×2, ×3
  …), lays an egg that hatches next session (chicks cheer in the nest), and the plumage grows at
  nest 3 and 5 (down, first feathers, flight feathers). Records: the best session, the best day,
  the farthest flight and grań. A first session teaches with coach marks one control at a time
  (hold, release, the perfect slide, the crag, the sun, the thermal, the night, the Poryw).
* **Kept from version 1:** the root (Deuteronomy 32:11), the flight's physics, the art (the four
  lands' palettes, the eaglet's plumages, the mother eagle, the thermals); an old save keeps its
  session count and farthest flight (`migrate`, `ver: 2`).

**Źródła, version 2 (2026-11-07): Pipe Mania on the pilgrims' road.** The founder found the
rotate-to-connect Źródła boring, so it was rebuilt on Pipe Mania's loop (Pipe Dream and the modern
"water connect" puzzles), copied as closely as it serves play (the table's column above is the first
design; this paragraph replaces it):

* **The race (Pipe Mania).** A dry valley of 7×5 cells growing to 8×7; the spring's well-head sits
  a step in from the edge, its outlet toward the open middle. A dispenser shows the next **five
  stones** (the next on top, gold-framed): two straights, four bends, the cross and, from valley 3,
  a **pool**. Stones never turn. A tap on a free cell lays the next stone there; a tap on a dry stone
  **swaps** it (Pipe Mania's bomb: Kumka shovels the old one out, the hands wait 0.35 s and an input
  meanwhile waits its turn; no point penalty). After a **countdown** (11 s, down to 8) the spring
  opens and the water runs cell by cell (2.3 s a cell, down to 1.25) through whatever it meets;
  where the way ends it spills. The open end of the way pulses (coral when the water is a cell
  away). Arrows move a cursor and Enter lays (Pipe Dream's keys).
* **Goals and stars.** Each valley has a distance goal (6 cells, +0.8 a valley, a breather at each
  station's start); ★ = the goal, ★★ = +4, ★★★ = +8. A station's fourth valley ends in a **garden**
  the water must reach. A cross run twice is a **loop** (+50, five in a valley +500); a pool fills
  three times slower and pays +100; an **old aqueduct** stone (fixed, from valley 4) pays +50; a
  **one-way** stone (from valley 10) lets water through one way. Each cell is 10 jars; each cell
  past the goal +20 at the end, each star +50.
* **Space** is Kumka's help and Pipe Dream's fast forward: until the way holds the goal it lays the
  next stone where it continues the way (or parks it out of the water's road, as Pipe Mania players
  do); once it does, Space lets the water run **fast** (×7, every cell ×2). A faint ghost shows
  where Space would lay.
* **Grace.** A spill short of the goal is never a lost session: "Woda wsiąkła w piasek", the near
  miss ("Zabrakło 2 odcinków"), the jars stay and the same valley comes again. No unused-stone
  penalty, no lives.
* **Zastawka (push: time).** Past the lead-in (5 s Mendi, 2 s HALO) the sluice follows the level;
  above the threshold the water's pressure drops and it runs slower, down to 45 % of its pace: room
  to plan. Drawn on the spring itself (the sluice gate lowers, gold above the
  threshold) and on the spring's **manometer** beside the valley (the threshold mark at the top,
  gold beyond it, the needle; the panel's "Zastawka" is the same number); the water under a closed
  sluice turns deeper and its ripples slow. A held focus fills the manometer's ring; full, the
  **Cisza wód** — the water stands still for 5 s, glinting (the power moment). A passed push adds
  a third of a charge. Blind (every 4th push from the 3rd session): earth covers the dial, the
  sluice still acts, the charge waits and is released at the block's end ("Pod ziemią zastawka
  trzymała 9 s"). Without signal the sluice eases to neutral: the base pace, never faster.
* **Sela (rest: the valley greens).** The water runs a little gentler (85 %); calm grows gardens
  along the cells the water reached, from the spring outward, three at a time; each in bloom +30
  jars and flowers; a passed rest greens every wet cell at once. The panel's "Zieleń doliny".
* **The reeds** along the valley's foot keep the band's last 40 s (gold heads above the threshold,
  cool behind a rest, gaps without signal, veiled in a blind block).
* **Kumka the tree frog**, "a plumber with a diploma", in a pilgrim's straw hat, talks (21 moments,
  three lines each, four languages): she measures in ribbits, wants to sit in every pool, knows
  "all fifteen Songs of Ascents — the first words of each", and gets wetter as Jerusalem nears.
* **Story.** The first session opens on a card (pilgrims crossing the Valley of Baca, Psalm 84:5-6);
  a tally card ends a won valley, a spill card a short one; a **station card** opens each of the
  road's fifteen stations (the Songs of Ascents, Psalms 120–134), with the passage scripture.ts
  holds for it (Ps 121:1-2, 126:5, 127:1, 131:2, 133:3); Kumka's closing line in the summary.
  Closing passages: the road walked — Psalm 84:5-6; a station — Psalm 121:1-2; a garden reached —
  Isaiah 58:11; three stars — Isaiah 35:7; still waters — Psalm 23:1-3; blooms — 1 Corinthians
  3:6; loops — Psalm 1:2-3; else Isaiah 41:18, Psalm 126:5, Isaiah 58:11 in turn.
* **Meta.** The road (15 stations × 4 valleys, then valleys by the road), the best stars per
  valley, flowers, loops and the longest stream; the lobby's card shows the stations and the last
  valleys' stars, the lobby's picture the road along its foot. A first session teaches with coach
  marks one thing at a time (tap, the queue, the countdown, the goal, Space, the flow, the swap, the
  fast flow, the sluice, the gardens; the cross, the pool, the garden valley, the aqueduct and the
  one-way stone when they first appear).
* **Kept from version 1:** the root (Psalm 84:5-6), the relief-map palette (limestone, contour
  lines, rose rock, turquoise water, sage), the jar as the unit; an old save keeps its best session
  and session count (`migrate`, `ver: 2`).

**Glina, version 2 (2026-11-07): Let's Create! Pottery in the potter's house.** The founder found the
chalk-line Glina boring and unclear, so it was rebuilt on the pottery sims' loop (Let's Create!
Pottery, Pottery Master, Pottery Lab), copied as closely as it serves play (the table's column above
is the first design; this paragraph replaces it):

* **The wheel (Let's Create! Pottery).** A lump lands on the spinning wheel; a finger on the wall
  pulls the wall to the finger at that height under a soft brush (in = narrower, out = wider — the
  clay follows the finger smoothly), a finger at the rim pulls the pot up or presses it down. The pot
  is a smooth, symmetric radius-by-height curve at 16 rings (`shape.ts`), drawn as a lit vessel row
  by row with throwing rings, grog specks and a specular band (`vessel.ts`). The order's outline is
  dashed on the stage; the ticket shows the live match (rings and height against the order, 0–100 %)
  and its stars (★★ from 72 %, ★★★ from 88 %). **Gotowe** (or Space) cuts the piece off with the
  wire; a poor shape gets the master's hand first (it shapes toward the order up to 72 %, 90 % on a
  steady wheel), so a piece is never lost.
* **Orders and customers.** Customers come to the counter with a slip: a silhouette, a glaze and
  sometimes a painted band (from the third piece ever). Three regular households (Tobias the
  innkeeper, Huldah the baker, Miriam and Nathan the newlyweds) each have a four-step story (a cup
  for the traveller at dusk, a basin for the guests' feet, … the lidded jar for the deed to their
  field, Jeremiah 32:14); a session's first order moves the shortest story on when it sells with ★★
  or more, with a story card. Walk-ins (Amos the shepherd boy, Baruch the scribe, Anna the widow,
  the merchant from Tyre, Zebedee the fisherman) order the forms open so far. Forms unlock one per
  six stars earned (four at the start, twelve in all).
* **Toczenie (push): steadiness.** The pieces dry on the kiln shelf (3 places, +1 per kiln level);
  beyond it they go to the market basket (half price, sold as a lot). Past the lead-in (5 s Mendi,
  2 s HALO) the level drives the wheel's **steadiness** (the panel's "Spokojne koło"): a spirit level
  on the wheel's frame (its bubble sits inside the two threshold marks from 0.5 on, the vial turns
  gold), a wobble that roughens every stroke and shakes the pot when low; from the threshold the
  **master's golden guide line** traces the order with an arrow at the ring furthest off, the clay
  follows the finger faster and trues itself, and from 0.7 a stroke near the order snaps onto it.
  Held focus fills the **master's hand** (11 s Mendi, 7 s HALO; a passed push adds 0.35): full, a
  golden spin trues the piece on the wheel to 97 % (★★★, ×1.5 tip) — the push's big moment. A passed
  push also adds 15 % to its batch's prices. Blind (every 4th push from the 3rd session): a linen
  cloth over the level, no guide line, the steadiness still works; at the end the share is revealed
  with a few shekels. The wheel head's throwing rings keep the band's last 40 s (gold above the
  threshold, cool in rest, faint without signal).
* **Wypał (rest): even heat.** The batch is glazed on a banding wheel — a tap on a colour dips the
  piece (the brush takes other colours), a drag on the turning pot paints a band in the brush's
  colour and pattern (stripe, wave, dots, zigzag, olive sprig), Gotowe sends it to the kiln; the
  apprentice glazes what is late as asked. Calm builds the **even heat** (the panel's "Równy żar",
  drawn on the heat dial over the kiln: the green zone widens past two threshold ticks). At ~58 % of
  the block (calm has had time to build) the kiln is hot and the needle sweeps the big dial: a tap stops it — gold heart =
  perfect (×1.25, +15 % quality), green = good, outside = soft or scorched (×0.85, still sold). Even
  heat widens the green (0.14 → 0.32 of the dial) and slows and steadies the needle. The kiln opens
  in steam and each customer collects: stars from shape (60 %), decoration against the slip (25 %)
  and firing (15 %), a price, a tip by the stars (+30 % for ★★★), a reaction line, a streak of
  ★★★ multiplying the price (+10 % a step, ×1.5 at most), coins flying to the score. A passed rest
  brings the **kiln's gift** (flame blush, iron speckle, moon white) on the batch's best piece and a
  few shekels. Without signal the steadiness and the heat sit at the threshold: never a loss.
* **The warm-up** (first session): one whole order at a time — shape, glaze, fire, sell — taught
  with coach marks one gesture at a time (the rim up, the wall in, the wall out, Gotowe; a dip, a band,
  Gotowe; the needle; the sale; the level, the guide, the master's hand and the kiln when they first
  matter). Space finishes the step in front of the player (the master's hand, the slip's glaze and
  band, the needle), so the smoke test's taps and Space sell pieces within seconds.
* **Szamot** (en Grog, de Schamott, sv Chamotte), the ginger cat on the shelf, is the self-appointed
  head of quality control: he rates pots by whether he would fit in them, takes credit for the
  master's work and for calm kilns ("all thanks to my nap"), sleeps on a warm kiln and is startled by
  a master's spin (19 moments, four lines each, in four languages). Customers answer each sale in
  their own words (by stars, a wrong colour, a scorched or soft firing, a master's piece).
* **Story.** The opening card (Jeremiah goes down to the potter's house), a tally card after every
  firing, a card for each household's chapter, a closing line from Szamot in the summary. Closing
  passages: a household's story complete — Numbers 6:24-26; a master's spin — Jeremiah 18:4; the
  kiln's gift — Psalm 37:7; a new piece on the shelf — Isaiah 61:3; else 2 Corinthians 4:7 and
  Colossians 3:23 in turn.
* **Meta.** Shekels (the headline, "sykli") fill the purse; the lobby's card is the workshop's shop
  (glazes: celadon, cobalt, olive, turquoise, Tyrian purple; patterns; a smoother wheel ×3, +0.05
  steadiness each; a bigger kiln ×3, +1 place and a wider green each), the shelf (the best piece of
  every form, drawn small, an outline until made, the stars to the next form), the neighbours'
  stories and the records (best day, longest ★★★ streak). Near misses in the summary ("12 do
  rekordu").
* **Kept from version 1:** the root (Jeremiah 18:6), the vessel renderer and the palette, the twelve
  forms and their outlines, the three households, the wedging intro. A v1 save keeps its session
  count, its households' steps and glazes, and its record in centimetres (`legacyCm`, shown in the
  records); the rest starts fresh (`migrate`, `ver: 2`). The registry's unit stays `cm` until the
  shared catalog test moves to `sykli`; the module's `unit()` already says shekels.

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
Rebuilt in version 2 (§10) as a true three-lane runner after the founder found the first one
unclear: the original's mechanics nearly one for one, the band at the core, a talking stork and a
goat who eats letters.

* **The original, studied** (status file of the rebuild): Subway Surfers' instant lane swipes,
  jump, roll and the roll-in-the-air slam; low and high barriers, parked and oncoming trains, ramps
  onto roofs and roof runs; coin lines and arcs; magnet, super sneakers, 2× and jetpack; the
  hoverboard as a one-hit save; the inspector and his dog after a stumble; score = distance × a
  multiplier that mission sets of three raise for good; the daily word hunt; upgrades that lengthen
  the power-ups. **Dropped:** game over, keys and paid revives, mystery boxes, characters for sale,
  seasonal FOMO, the pogo stick.
* **View and verb.** Pseudo-3D from behind and above, three lanes converging to the dawn horizon
  (the camera follows a little across and up onto the roofs). Swipe or keys: ←/→ (A/D) a lane in
  0.11 s, ↑ (W, Space) jump, ↓ (S) roll — in the air ↓ slams down into a roll, ↑ while rolling
  jumps; presses wait 0.16 s for a landing (buffer). A tap on the left or right third steps a lane, a
  tap in the middle jumps (the smoke's input). A lane change mid-way is between lanes and hits
  nothing (forgiving); a change into a wagon's side bounces back with a stumble.
* **The road's vocabulary** (`track.ts`, seeded patterns that always leave a passable line): low
  fences and fallen columns (jump), beams on posts with a sign (roll), parked wagons (change lane),
  a ramp up a wagon and wagons nose to tail (a roof run, with drachmas on the roofs), ox-carts coming
  down a lane with a lantern (leave the lane, or vault in sandals), slaloms of wagons. Difficulty and
  speed (11 → 17 m/s) rise within a run; the patterns roll between breathers and peaks.
* **Power-ups on the road** (for everyone, band or not): the satchel (a magnet), sandals (high jumps
  onto roofs), the seal ×2 (double points), the shield (takes one hit). The lobby's upgrades bought
  with drachmas lengthen the first three and the flight.
* **Grace and the chaser.** Every hit is a stumble (slowed, a hit-stop and a shake): Bela the goat
  comes to the messenger's heels for 7 s; a second stumble while she is close and she has the letter
  — the run ends on a tally ("Bela ma list!", the run's points and metres, "120 pkt do rekordu
  biegu") and a new run starts 2.8 s later. The session never ends early and its score keeps every
  run's points. The first-ever lesson never ends a run.
* **Push — Skrzydła (the wings).** Klekot the stork circles at the top right; his gauge *is* the
  band's: the arc over him is the lift (`level`, gold above the threshold mark at the arc's top), his
  wings open with it, and past the lead-in (5 s Mendi, 2 s HALO) a level above the threshold fills
  the wind ring round him (≈ 8 s Mendi / 6 s HALO of clear focus). Full, he swoops down and carries
  the messenger over the roofs along a weaving trail of drachmas (8 s + the wings upgrade, longer while
  the focus holds, at most 12 s), untouchable, then lands him on a clear stretch — the run's best
  moment, the original's jetpack earned by the band. A level at or below the threshold adds nothing;
  a lost signal freezes the ring (never a loss). The panel's gauge is the same lift (`meter()`).
* **Rest — Strażnice.** The evening road: slower, only single fences and beams, long lines of
  drachmas. Watchtowers stand on both sides every 40 m; the next one's brazier shows the calm live
  with a dashed ring at the threshold, and `calm` ≥ 0.5 when it is passed lights it (points). Three
  fires fill the horn and the watchmen throw a shield. An unreliable moment leaves a tower neutral.
  A passed rest is the watchmen's song (+20 drachmas, a horn call).
* **Blind — Mgła.** Every 4th push from the 3rd session (never a session's first): the gauge and the
  ribbon are veiled, the ring fills unseen; at the block's end the mist lifts ("wind 74 %") and a full
  ring flies at once.
* **The signal in sight.** The stork's arc and ring (live, with the threshold on the thing itself),
  the towers' braziers in a rest, and the ribbon of dawn — the last 40 s across the open sky between
  the panel and the score on a wide screen (the dock's chart on a narrow one). The standard HUD
  (§10.2) shows the block, the strategy and the same gauge; the game draws no block card or score of
  its own.
* **Story and companion.** An opening card the first time (three sentences and Isaiah 52:7). Klekot
  — a fellow courier and a proud professional ("I usually carry something else, but a letter will
  do") — speaks short bubbles reacting to the run: a block's start, the wind caught, the flight and
  the landing, near misses, stumbles, Bela, being caught, stations, cities, the day's word, missions,
  the multiplier, power-ups, the shield, the fires, the inn (3–4 variants each, never repeated in a
  session, quiet over a telegraph or the banner). Relay stations (the cursus publicus' mutationes)
  every 450 m of a run take a letter (+100 × the multiplier); a city reached on the long road gets a
  postcard card.
* **Meta.** The road to the seven churches (metres add up across sessions; a postcard per city, its
  letter by reference only), drachmas and the four upgrades (5 levels each), the mission set of three
  (a full set raises the permanent score multiplier, up to ×30; sets come round again harder), the
  day's word (letters of a word in the player's language on the road, a streak of days), records
  (best session, best run, longest run). Saves of version 1 migrate in place (the record and the
  sessions kept, the road and the drachmas carried over).
* **First session.** A warm-up "Pierwsza mila" whose lesson road teaches one control at a time with
  the runner's coach mark pointing at the thing (jump the fence, roll under the beam, step aside from
  the wagon, run up the ramp), repeating a control until it was done; later the wings, the towers,
  Bela and each power-up are explained the first time they matter.
* **Headline.** Points this session (`pkt`): metres × the multiplier (×2 under the seal) plus
  stations, fires and the day's word; the line under it is "×multiplier · metres of this run".
  **Closing:** reaching a city: Romans 10:15; a flight: Habakkuk 3:19; the watchmen's song: Isaiah
  52:8; a long run: Philippians 3:14, 1 Corinthians 9:24, Hebrews 12:1; else Proverbs 25:25,
  2 Thessalonians 3:1.

### 7.4 Zacheusz — the short man in Jericho (Super Mario Run)

*Luke 19:3-4 — he was trying to see who Jesus was, but could not see over the crowd, so he ran on
ahead and climbed a sycamore-fig.* Jesus is never shown: the procession is a cloud of dust, palm
branches and a crowd far ahead; he is named only on the last story card.

**Version 2 (2026-11-07, a rebuild after Super Mario Run's World Tour).** The first version strung
seeded chunks into courses and was found boring; v2 copies Mario Run's verbs and structure closely.

* **The original's mechanics, kept or adapted.** Auto-run right; tap = short jump (≈ 1.3 u), hold =
  higher (≈ 2.8 u); coyote time (0.09 s) and a jump buffer (0.12 s); a ledge within reach of the
  hands is pulled up onto; geese and goats in the way are vaulted on their own, and landing on one's
  back bonks it (it wobbles with stars and waddles off — never hurt) for 1, 2, then 4 denarii in a
  row; against a wall in the air he slides, a tap kicks off it (repeated taps climb); a tap in the air
  is a spin, once a flight; awnings bounce (higher while held) and the crowd tosses him up
  (crowd-surfing, the crowd is never stomped); **pause stones** stop him until a tap (plan, then
  go); **◀ stones** run him back for 1.5 s, **▶ stones** dash, and a tap on one is a long jump.
  Pressed against a wall on the street for 1.4 s, a neighbour gives him a leg-up, so nothing ever
  soft-locks (a test runs the smoke test's crude hand through all twelve levels).
* **Levels.** Three worlds of four hand-made levels (Brama Jerycha, Dachy tkaczy, Gaj palmowy),
  built in code with a small cursor builder (`content.ts`): a first half per level and two or three
  stretches in its world's style, 30–45 s of plain running, more with the climbs and stops. Level
  1-1 teaches one thing at a time. Each level ends at the **finish palm** (Mario's flagpole: five
  height bands pay 1, 3, 5, 8, 12); each world's fourth level is the crowd's street and ends at the
  **sycamore**, with the world's story card. The levels open in turn; the lobby's card is the level
  select (a tap picks the level the next session starts from); a session plays one level after
  another, a tally card (count-up, stars, the crowd's cheers) between them.
* **Special denarii.** Five per level in each of three sets — silver, then gold, then purple on
  replays (Mario's pink, purple, black) — each set in other, harder places; a whole set in one run
  pays a bonus and reveals the next. The purple ones mostly hang near the light road's lane, also
  reachable by a held bounce or a wall climb. Five slots under the HUD fill as they are found.
* **Stars.** Finished; the level's coin target (60 % of its plain coins); the top of the palm.
* **Style** (Toad Rally's cheers). Spins, vault-spins, wall jumps, bonks, long jumps, springs and
  the palm's top are tricks; tricks in one flight multiply; the townsfolk on the roofs behind cheer,
  and the points become denarii at the tally.
* **Grace.** A fall into a ditch or a well is a **bubble** (two a level, more from ripe fig trees):
  it floats back to where he stood 3 s earlier and pops on a tap (or by itself), so a missed special
  can be tried again; the bubble button (bottom right, or B / ←) rewinds on purpose. With no bubble
  left the neighbour's rope pulls him out on the far rim. Never a game over, never a timer.
* **Push — Wypatrywanie: the path.** After the lead-in (5 s Mendi, 2 s HALO), while the level stands
  above the threshold, a **road of light** grows over the roofs at the lane (3.6 u): its reach ahead
  of him is `2 + 12 × level` u, so it builds only above the threshold, and a spring of light lifts
  him onto it (springs every 8 u under it). On it he runs faster, light coins line it, and it leads
  to the high specials. Below the threshold it stops growing (the planks laid stay); an unreliable
  signal freezes it. On the lane itself, a dotted line and a little flag mark where the road reaches
  at the threshold, a glowing post where it reaches now. A held focus (6 s Mendi, 4 s HALO) is a
  "Widok": light coins shower the road (at most three a block). The panel's gauge is that reach
  ("Zasięg drogi ze światła").
* **Rest — Cień sykomory: the orchard.** At the rest block's telegraph the street opens at the next
  safe place into a **fig orchard** spliced into the level (`World.splice`), long enough for the
  block at a walk; no pits; `calm` ripens the figs (`R`), picked as he passes a tree (a denarius
  each); a full tree gives a bubble. A passed rest: a basket of figs.
* **Blind — Tłum.** Every 4th push from the 3rd session: the crowd's backs veil the palms and the road
  does not grow; at the end its last 15 s of focus become a revealed stretch of road with its spring.
* **The signal in sight.** The skyline of palms along the horizon is the history (40 s, one palm a
  second, gold crown above the threshold, blue-green in rest, a stump without signal, the crowd
  over a blind block, a dotted bracket over the band's delay); the road and its threshold flag are
  the live gauge.
* **Companion: Mela**, the neighbour's goat, trotting behind him with a bell. Running jokes: every
  goose and goat he bonks is her relative ("That was my cousin. He had it coming."), she eats what is
  not nailed down (awnings, the ledger), and his height ("not short — compact"). 19 moments, 3–6
  lines each, in four languages.
* **Story.** An opening card (Jericho, Zacchaeus wants to see; Luke 19:3-4 under it), a card at each
  world's sycamore (the procession turned away; the branches seen far off; the last: Jesus stops,
  looks up and calls him by name, with Luke 19:5, and the denarii go back fourfold).
* **Meta.** Fourfold (Luke 19:8): every denarius goes back to Jericho's twelve households on the
  town map (a roof, a door, a goat…), restored by the all-time sum, never spent; the level map with
  stars and sets; three missions; the day's gift. Old v1 saves keep sessions, records, denarii, figs
  and the blind-block count (`migrate()`).
* **Headline.** Denarii this session (`unit(n)` bends), the line under it the level code and the
  specials ("1-2 · ◆ 3/5"). **Closing:** the palm's top or a world's sycamore: Luke 19:5; a household
  restored: Luke 19:8; a long view: Hebrews 12:2, Psalm 34:5; a fall rewound: Luke 19:10; else Luke
  19:6.
* **Dropped from the original:** the timer and time-out loss, limited bubbles ending a course,
  power-ups from ? blocks (the band's road is the power moment), Toad Rally's versus, Remix 10,
  tickets, the paid unlock.

### 7.5 Pasterz — the flock on the hills (Crowd City)

*Luke 15:4-6 — the man with a hundred sheep who goes after the one that is lost.* The shepherd is
the parable's man, not a picture of Christ.

**Version 2 (2026-11-07): Crowd City on the Judean hills.** The founder found the pasture-and-fold
Pasterz boring, so it was rebuilt on Voodoo's *Crowd City* loop, copied as closely as it serves play.
After a spring storm the whole village's sheep are scattered over the hills; the shepherd and five
rival shepherd kids (Szymek Śpioch, Tobiasz Łasuch, Ruta Gaduła, Ezaw Kudłaty, Mała Mirka — each with
a dye and a comic habit: a nap, a snack, a chat, a bold or a timid streak) race to bring home the
most. It is a friendly village race: sheep follow the bigger flock (which sheep do), and in the
evening every flock goes into the one fold.

* **Controls (Crowd City).** Drag anywhere: a floating joystick walks the shepherd (arrows and WASD
  too). Left alone for 1.2 s, **Łatek** the sheepdog leads him at a walk to the nearest loose sheep
  and away from bigger flocks. A tap or Space **whistles**: Łatek dashes to the nearest loose sheep
  within 11 m and herds every loose sheep around it into the flock (3 s cooldown) — the smoke test's
  centre taps gather sheep with no steering at all.
* **The crowd (Crowd City).** Undyed sheep graze in groups and fill the dry-stone **pens** (the
  plazas). A loose sheep touched by any sheep of a flock, or by its shepherd, joins it, takes its dye
  and swarms behind him (separation, alignment, a keep radius of 0.8 + 0.34 √n m; followers route
  over the bridges and through the pens' gates and bend around rocks). Stragglers wander in from the
  far hills when the loose sheep run low. A big flock slows its shepherd a little; the camera zooms
  out as it grows.
* **Flock against flock (Crowd City's rule).** Where two flocks touch, the bigger wins the smaller
  one's sheep one by one at the contact (22 a second, each switched sheep immune for 0.45 s), so a
  clash streams rather than snaps. A rival with no sheep left, touched by a bigger flock, is **out**
  till the round ends: he sits facing away under a little rain cloud and sulks ("Hmpf! Nie gram.").
  The player is never out (grace, §5): eaten down to the shepherd, Łatek drags him by the cloak to a
  quiet spot by loose sheep with 3 s in which nothing can touch him. The rivals' minds: flee a flock
  ≥ 1.15× theirs within 9 m, hunt one < 0.8× theirs within 12 m (a chase gives up after 7 s), else
  go for loose sheep, the pens worth a detour.
* **Rounds (Crowd City's two minutes).** A round ("pastwisko") spans two Wołanie days and the nights
  between (about 95 s; `planBlocks` gives every night that ends a round `roundEnd`) on one hill of
  the map. A live **ranking** (the top three and the player, with the pasture's time left) sits under
  the score; a **crown** over the biggest flock; off-screen rivals are arrows at the edge in their dye
  with their count, and every shepherd carries his count over his head. At dawn the **tally card**
  (during the next Wołanie's lead-in, the world holding still) banks the flock: + 20 % + 5 for the
  crown, + 2 for the second place, + 10 for the lost lamb; "do korony zabrakło: 4 owce"; the
  wardrobe's progress bar; the next hill and its line of story. Then a new hill and a new race.
* **The lost lamb (Luke 15:4).** One lamb hides far from the start each round (≥ 24 m), bleating
  every 7 s (a "Bee?" mark at the screen's edge points its way). Walk to it and it rides on the
  shoulders; carried at dawn it is worth 10 and gets one of twelve names and a bell.
* **Push — Wołanie** (the call, John 10:3): after the lead-in (5 s Mendi / 2 s HALO) the **call
  ring's** radius is 1.5 + 6 × `level` m — a dotted circle marks the threshold (4.5 m) and the rim
  turns gold beyond it, motes drift in along it — and every loose sheep inside it walks in and joins.
  A held focus (5 s Mendi / 3 s HALO, twice a block, 10 s apart) sends the **Głos**: a gold ripple
  across the hill, every loose sheep within 15 m walks over, and the lost lamb's compass shows for
  7 s. The ring is the game's biggest power: at full reach a pass through a meadow sweeps it clean.
  The panel's gauge is the ring itself (0 at r0, 50 % at the threshold).
* **Rest — Nocna straż** (Luke 2:8): night falls on the whole hill and every flock beds down by its
  fire — a truce, nobody takes anybody's sheep. `calm` (after a 4 s / 2 s lead-in) lights a row of
  twelve stars; each star "counts a sheep": its light falls on a straggler in the dark and Łatek
  fetches it into the flock (the harvest). The rivals' kids get 2–4 stragglers a night each, so a
  calm night is the player's edge. At dawn a passed night brings morning lambs (2, +1 at 6 stars, +1
  at 10); a night without a pass still brings one. The gauge is the night's calm.
* **Blind — Zmrok** (dusk): every 4th Wołanie from the 3rd session; the ring stays at r0, the
  footprints are veiled; at the end the ring flares to 1.2 × its radius for the judged share and
  pulls in what it reaches, and the footprints are revealed.
* **The signal in sight.** The call ring (live, with the threshold on it) and the **footprints**
  behind the shepherd (the band's last 40 s on the ground: gold above the threshold, blue in a
  night, grey without signal, veiled in a blind block). The runner's panel and dock show the rest.
* **Story and companion.** The opening card (first-ever session, on the calibration scene): the storm,
  the six shepherds, one lost lamb bleating far away, and Luke 15:4-6. Łatek talks in drawn bubbles
  (three or more lines per moment: the opening, a Wołanie, the gold rim, the Głos, a night, a star, a
  sheep lost to a bigger flock, a flock won, a tumble, the lamb, the crown, a dawn, the evening, the
  first rival, the dusk, a bleat); his running jokes are counting badly ("Raz gwiazda, dwie gwiazdy…
  Ile to owiec? Dużo!"), mistaking rocks for sheep and "they have a worse dog". The rivals say their
  own little lines. Between rounds the tally names the next hill with a line of story; the summary
  closes with "Wieczorem wszystkie stada weszły do jednej owczarni".
* **Tutorial.** The first-ever session opens with the warm-up and teaches by coach marks, one at a
  time, when each first matters: drag (repeated until the player has dragged), touch to join, the
  whistle (repeated until whistled), the first rival ("bigger takes from smaller"), a smaller flock
  to take, the ring at the first sighted Wołanie, the night, the lost lamb's bleat. Later sessions
  show only what was not yet learnt.
* **Meta.** The **hills map**: eight hills in turn (Pola Betlejem, Wzgórza Tekoa, Bród Jordanu, Stoki
  Hermonu, Łąki Saronu, Pastwiska Gileadu, Niziny Szefeli, Góra Karmel), each with its river and
  bridges, pens, trees and greens, and the crowns won on it. **The hundred** (Luke 15:4): a tenth of
  each round's flock (at least one) stays as the home flock; at a hundred a new season begins. The
  **twelve lost lambs** with names and bells. The **wardrobe** (Crowd City's skins): six cloaks, four
  crooks and four coats for Łatek, one new piece every 60 sheep gathered, worn at once and chosen in
  the lobby's card. Progress is version 2: an old save keeps its records and session count.
* **Headline.** The session's sheep: the rounds banked plus the flock now (`unit(n)` bends), so the
  number climbs the moment a sheep joins and jumps at each tally; the line under it is the place
  ("2. miejsce z 6"), the night's stars, or the count. **Closing:** the lost lamb carried home: Luke
  15:4-6 or Isaiah 40:11; the voice across the hill: John 10:3, John 10:27; a calm night: Luke 2:8,
  Psalm 147:4; a crown or a big flock: Ezekiel 34:12; else Psalm 100:3, Psalm 23:1-3.

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
Jesus sends you to keep a child's sleep (Matthew 18:10). Each session is one night; the nights are
the chapters of the child's dreams. **Version 2 (2026-11-07, expanded):** the founder called it good;
it keeps its core and look and takes more of the two-sided tap brawlers (One Finger Death Punch,
Endless Puncher, Kung Fu Z): readable enemy tells with their own counters, a combo ladder with a
perfect window, bosses with telegraphs and phases, upgrades between nights, chapters with stars.

* **View and verb.** A side view of the child's bed at night (in the room: a window, a wardrobe's
  shadow, a door ajar, a warm lamp, toys); the angel hovers over the bed. Zmory (nightmares: ink,
  smoke and ember eyes) creep in from both sides. A tap on the left or right third (←/→, A/D)
  strikes that side with a sweep of light that reaches R; it hits the nearest thing inside the reach
  (a Zmora, or an ink drop, which flies back). The middle third and Space strike the side whose
  Zmora is nearer (the smoke's input). A strike at nothing is a whiff: 0.25 s of recovery, the combo
  resets (in a lullaby it is a harp note instead). Juice: hit-stop, sparks, squash, flying feathers,
  a bell that climbs the combo.
* **The combo ladder and the perfect window** (OFDP's range and greed). Hits climb a ladder of
  feathers ×2/×3/×4/×5 at 8/20/40/70, drawn by the angel (the number, its rung bar, the colour
  warming up the ladder); a whiff or a Zmora at the bed breaks it. The reach's outer 0.45 u is a
  gold band on the floor: a hit while the target has just come in is **Idealnie!** — +2 on the
  combo and a feather more. A Zmora struck at the very bed is a close call ("o włos"), tallied.
* **The Zmory, each with a tell and a counter.** *Mara* walks, one hit. *Skoczek* leaps — hit it as
  it lands. *Widmo* flickers, two hits, slips back. *Pancerna* wears armour: strikes bounce; three
  bounces crack it (the aura sooner), so it never needs the band. *Rój* breaks into three shades.
  New: *Fikołek* (← → pips over it) somersaults over the bed after the first hit — finish it on the
  other side; *Kleks* stops out of reach, puffs up (the tell) and spits an ink drop — strike the drop
  and it flies back and banishes it; *Ciągutek* (taffy) at the bed holds on and slowly dims Sen
  until mashed off (three hits); *Szept* shows only its ember eyes in the dark — the aura, the lamp
  or a sweep reveal its body. Each kind gets a coach mark the first time it steps out.
* **Nights as chapters.** Three nights a dream, the last goes on: **Pokój** (the room: Mara, Skoczek,
  Widmo, Pancerna), **Strych** (the attic: Kleks, Rój), **Las** (the forest: Fikołek, Szept),
  **Morze** (the sea, the bed a raft: Ciągutek), **Obłoki** (the clouds: all of them). Each dream has
  its backdrop, a story card at the night's start (the first-ever night: three sentences and
  Psalm 91:11), its passage (Psalm 4:8, Psalm 139:12, Psalm 23:4, Isaiah 43:2, Psalm 19:1) and its
  **great nightmare** at the night's end (22 s in sessions of 2 min+, 9 s shorter), with a light bar
  and a second phase at half (quicker, new tricks): *Koszmar* — hits per phase, then it turns to the
  other side (phase 2 leaves a Mara behind); *Kufer* — a trunk of shadow out of reach that lifts its
  lid (the tell) and spits ink: only drops struck back hurt it (phase 2: two drops, then it hops over
  the bed); *Wilk z mgły* — waits, crouches with a pulsing arrow (the tell), dashes to the bed and
  stays open: a strike then is a counter (2); phase 2 feints and leaps to the other side; *Ośmiornica*
  — rises behind the bed out of reach, its arms reach from both sides (both at once in phase 2) and
  each arm banished hurts it; *Burza* — dashes, spits, then arms. Not banished, it flees at dawn.
  A night earns stars: ★ kept, ★ the great nightmare banished, ★ Sen never ran out with a combo of 15.
* **Push — Czuwanie** (vigil): `level` is the **aura**, drawn large around the bed: its radius is
  1.4 + 3 × `level` u, a dotted dome labelled "próg" marks the threshold, the rim turns gold and glows
  beyond it. Inside it the Zmory slow down and take light per second in proportion to how far the
  level stands above the threshold, and armour cracks while it stands above. `hold` charges the
  **Płomień** (5 s Mendi / 3 s HALO, three a block), a ring around the angel: at full, every Zmora on
  screen is banished and **Skrzydła ognia** follow — 5 s in which every strike pierces its whole side
  and hits double (the run's power fantasy). The panel's gauge is the aura's reach (0.5 at the dome).
* **Rest — Kołysanka** (lullaby): the Zmory draw back into the dark; the angel sings, the child
  mumbles in its sleep. `calm` (after a 4 s / 2 s lead-in) fills the dream bubble with stars: Sen
  comes back and feathers fall; a passed rest pays 10 more. The gauge is the lullaby's calm.
* **Blind — Mgła snu:** every 4th push from the 3rd session the aura is not drawn and does not act;
  at the block's end its last 15 s become a dawn burst of the same strength, all at once.
* **Grace.** A Zmora at the bed dims Sen and breaks the combo; when Sen runs out the child stirs, the
  angel comforts it, the Zmory near scatter and Sen comes back to half. Nothing ends the night early.
* **Levels and gifts (the run).** Feathers are XP; every level-up offers one of three gifts for the
  night in slow motion (longer reach, a double strike, a wing shield, a spear of light, a wider aura,
  a faster Płomień, a night lamp, a fresh dream); the first is taken by itself after 5 s.
* **Meta.** The angel's rank (all feathers ever) widens the pool of gifts and furnishes the room (a
  mobile, a moon night light, a book, a starry blanket, a nightcap for the bear, cloud curtains, a
  garland). The feathers also fill a wallet for the **tree of gifts** in the lobby: three branches
  (Skrzydła: reach +5 %/level, the perfect band +22 %; Światło: the aura +7 %, the Płomień 8 % sooner;
  Sen: the Zmory dim Sen 10 % less, lullaby stars +12 %), two upgrades each, four levels (25, 55, 95,
  150 feathers), the second of a branch after the first; every row shows its number now → next. The
  lobby's map shows the five dreams with each night's stars. Progress is version 2 (`ver: 2`): an
  old save keeps its records, sessions and feathers, starts the dreams anew and gets up to 150
  feathers in the wallet.
* **Companion: Pan Guzik**, the child's teddy bear with one button eye, sits on the bed's foot and
  talks in drawn bubbles (3–5 lines a moment, ≤ 90 characters, one at a time, never in a block's
  first 5 s or its telegraph): the opening, a Czuwanie, the fog, a lullaby, a good stretch, a
  Płomień, a combo rung, three perfects, a near miss, a stir, a new kind, the boss, its second phase,
  its fall, a gift, the dawn. Running jokes: he claims the credit, he "is not scared" (his paws go
  over his eyes when something reaches the bed), his only eye is a button, a sock in reserve, honey.
  The child mumbles in its sleep in the lullaby ("…nie chcę brokułów…").
* **Instructions.** `howto()`: the goal, tap a side, the middle, the keys, two tips. The first-ever
  night teaches with coach marks, one at a time and when each first matters: the first Zmora in
  reach, the middle after three hits, a whiff, the perfect band, the aura, the Płomień, Skrzydła
  ognia, the lullaby, Sen, a gift, a combo; later nights only what is new (a kind, a boss). Stale
  marks wait for another night.
* **The signal in sight.** The aura (live, the threshold on it), the Płomień's ring (hold), the
  window: the band's last 40 s in its sky and a star a second on its sill (kit/trace). The runner's
  panel, score and dock show the rest; the game draws no score or block card of its own.
* **Headline.** Zmory banished (`zmora/zmory/zmór`); under it the combo and its multiplier, else
  "do rekordu: n" when close, else the dream and the night. The summary adds the night's stars, the
  near misses (to the record, to the next combo rung, close calls) and where the dream goes next.
  **Closing:** the first night: Matthew 18:10; a Płomień: Psalm 34:7; the great nightmare banished:
  John 1:5; many Zmory: Psalm 91:5; Sen never ran out: Proverbs 3:24; a long vigil: Psalm 121:4; a
  passed rest: Psalm 4:8; a new rank: Hebrews 1:14; else Psalm 127:2.

### 8.3 Zastępy — the hosts at the two gates (lane battler)

*Revelation 12:7-8 — "Michael and his angels fought against the dragon … but he was not strong
enough."* The gate of light on the left, the gate of ash on the right, one road between them.

Version 2 (2026-11-07, an expansion: the core and the look stay) takes more of We Are Warriors!:
readable unit counters, ages that re-dress the fortress, a hero power, boss gates, a campaign map,
upgrades with their numbers, a companion and story cards.

* **View and verb.** A side view of one road across a sky of clouds, the gates at both ends (the
  camera follows the front on a phone; a drag pans). Light flows into a bar; unit cards along the
  bottom cost light and have a short cooldown; a tap on a card (1–7, Space = the cheapest ready card)
  sends that angel out of the gate. Units walk and fight on contact by themselves; the battle is won
  when the gate of ash falls. A **tap on the road** (H) raises the hero power where you tap.
* **The host and the counters.** Seven angels, each the bane (×2) of one shade: Strażnik → Cienie,
  Włócznik (new, a spear held level) → Ogary, Łucznik → Skrzydlaki (only bows, fire and the beam reach
  fliers), Jeździec (Revelation 19:14) → Miotacze (new, shades with slings of embers), Serafin →
  Chochliki, Archanioł → Bestie (and ×1.5 on bosses); Tarczownik takes ×0.4 from anything thrown.
  The shades bite back: a hound ×1.6 on archers, a brute ×1.6 on the foot. Each wave leans on one
  kind and is **announced** 2.6 s ahead by its icons over the gate of ash; the card that answers it
  glows with "×2" and a ×2 flies off every bane strike. A player who answers the waves wins where one
  who sends blindly withdraws (tested headless).
* **Hero power — Słup obłoku** (the pillar of cloud that stood between the camps, Exodus 14:19-20):
  4 s where it is raised; no shade passes it, its fire burns those at it, and it takes a boss's blow
  for the host behind it. Cooldown 20 s; its level (gold) makes it stand longer, return sooner and
  burn hotter.
* **The campaign.** Chapters of five battles on a map with three stars per battle (won; half the
  walls left; four fifths); the fifth is a **boss gate**, sealed while its boss stands: the Kolos
  (stomp: the road in front of it glows red, then a shockwave), the Szarańcza (calls a swarm of
  wings — answer with bows), the Smok (a cone of fire breath). Each special is telegraphed for 1.8 s;
  the pillar in front of it or the trumpet (which breaks a wind-up off) answers it.
* **Ages of the fortress.** Each chapter past a boss is a new age — stone, cedar, bronze, gold,
  pearl: the gate grows taller and changes its material, banner and fittings; the host wears a sash,
  a bronze then a gold breastplate, a pearl one; ×1.2 power per age. The shades grow per chapter too
  (×1.26), so upgrades still matter. The evolution never resets anything (the original's reset was
  dropped as punishing).
* **Gold and the upgrades.** Demons beaten, battles won, new stars and passed rests pay gold; between
  battles a card offers three upgrades — the gate (walls, flow, beam, new cards), the pillar, and one
  unit (the answer to a shade that marches for the first time in the next battle) — each with its
  numbers before → after ("Mury 650 → 740 · światło 4,5 → 5,0/s"). The lobby's card buys them too.
* **Push — Natarcie** (the advance): `level` above the threshold speeds the flow of light (up to
  ×2.2 at the top; never below the base flow — no penalty), so a held focus fields a larger host;
  `hold` charges the **Trąba** (trumpet): at full a tap on it (or T) sounds it — a shockwave throws
  the demons back, wounds them and breaks a boss's special off. The **lantern** at the left of the
  light row is the thing drawn large: its arc is the level with the threshold tick at its top, its
  flame grows with the stream, ×n under it, and motes pour from it into the light bar.
* **Rest — Cisza** (*Exodus 14:14*): the demons' waves slow; `calm` mends the gate's walls and lays a
  shield of light on the front-line units (the lantern turns blue, its arc the calm, motes flow into
  the walls); a passed Cisza mends the walls at once and pays gold.
* **Grace.** If the gate of light falls, the host withdraws: the gold is kept, the battle starts
  again with stronger walls. Never an ending.
* **Blind — Mgła bitewna:** the push block's extra light is not shown and not paid while it runs (the
  lantern fogs); at its end it is paid at once by the block's last 15 s of focus.
* **The standard HUD.** The runner's panel names the gauge "Strumień światła" / "Mury bramy"
  (`meter()` = the level / the calm, null blind or without signal); the score corner shows demons
  beaten with "bitwa 2/5 · rozdz. 1", the boss's name or the record within reach. The game draws only
  the battle's bar under the panel, the banners along the road (the 40 s history), the light row
  and the cards. Coach marks (`env.hint`) teach the card, the pillar, the first counter, the trumpet,
  the upgrade card, the boss's red ground and the Cisza, each once per player.
* **Tymek and the story.** Tymek, a cadet who keeps the host's chronicle, talks from the top-left
  corner (18 moments, 3–4 lines each; running jokes: the chronicle, the trumpet he keeps polishing,
  the hounds he does not like). Story cards: the opening ("Dwie bramy" with Revelation 12:7-8) and
  one per new age; the battle waits while a card is up. The summary ends on "Kronika Tymka: rozdział
  c, bitwa n czeka na Ciebie".
* **Saves.** Progress v2 (`ver: 2`); a v1 save is migrated in place and keeps its gold, gate, unit
  levels, battle reached (the chapters are counted from it), records and sessions.
* **Headline.** Demons beaten (`demonów`). **Closing:** a battle won: Ephesians 6:10-11; a comeback
  after a withdrawal: Romans 12:21; a boss gate broken: 1 John 4:4; the trumpet: James 4:7; a new
  gate level: 2 Corinthians 10:4; a passed rest: Exodus 14:14; else Revelation 12:7-8.

### 8.4 Firmament — stars in threes (match-3 saga)

*Psalm 147:4 — "He determines the number of the stars; He calls them each by name."* Version 2
(2026-11-07) rebuilt it after Candy Crush Saga, with Royal Match's square for the modern feel. Bubo,
a young eagle-owl astronomer in glasses too big for him, got a telescope from his grandma and wants to
count every star; the player sets the sky in order three at a time.

* **The saga.** Constellations of eight stars, each star a level (Candy Crush's episodes). Each
  constellation opens with a story card — a Bible star story told in two sentences and its passage:
  the first lights (Genesis 1:16), Abraham counting the stars (Genesis 15:5), the morning stars
  singing (Job 38:7), the Magi's star (Matthew 2:10), the wise who shine (Daniel 12:3), each by name
  (Isaiah 40:26); the very first session opens with Bubo and Psalm 147:4. A won level ends on the
  map: the stars of the tally one by one, the constellation with the new star igniting.
* **Board and verb.** Up to 8×8 cells shaped by holes, six kinds of sky bodies with distinct
  silhouettes; swap two neighbours (a drag, or a tap and a tap); an invalid swap bounces back free.
  Gravity runs straight down and slides diagonally past what blocks a column; a hole's lower edge
  refills like the top. Space plays the best move (keyboard play and the smoke test); arrows and
  Enter move a cursor; a hint glows after 5 s idle; no move left reshuffles the sky.
* **Specials, exactly the genre's.** Four in a line → Kometa (a beam across the line); an L or a T
  → Supernowa (3×3, then again after the fall); five → Pulsar (every body of one kind); a square of
  four → Meteor (flies to what the level wants cleared). Combos: comet + comet a cross, comet +
  supernova three rows and three columns, supernova + supernova 5×5 twice, pulsar + special turns
  every body of that kind into it and fires them, pulsar + pulsar the whole sky, a meteor carries the
  other special to its target. Cascades climb in pitch and in words (Ładnie! Jasno! Promiennie!
  Gwiezdnie!), with hit-stop and a shake on the big ones.
* **One goal per level, varying.** A score (the level plays all its moves, as Candy Crush's moves
  levels); dark clouds (1–2 layers under the bodies — Candy Crush's jelly); moons to bring down to the
  bottom (ingredients); bodies of a kind to collect (orders); asteroids to break (frosting, 1–3 hits).
  Obstacles join one at a time: orbit locks (licorice), ink that spreads when a move does not touch it
  (chocolate; it dissolves into light, never a face). Limited moves, three stars by score; the last
  star of each constellation is a hard level, the next one a breather. Three constellations are
  hand-made, later ones come from a seeded generator — the same level for everyone; the levels are
  checked by a greedy bot in the tests.
* **Deszcz komet (Sugar Crush).** A met goal fires the specials left and turns every move left into a
  comet that fires, with points for each — the payoff for playing well.
* **Out of moves — a gentle retry.** No lives: a card says what was missing ("Brakowało: 2 chmury"),
  offers +5 moves when the tray holds them, and otherwise starts a new sky for the same level after
  a few seconds; the session's points stay. In a push block with the charge ring nearly full, the
  retry waits a few seconds for the tool that saves the level.
* **The telescope (push — Obserwacja; band pattern: charge).** After the lead-in (5 s Mendi, 2 s
  HALO), `level` above the threshold fills the charge ring round the lens; a full ring (≈ 8 s of good
  focus) puts a **tool** in the tray (3, then 4): the star hammer (one cell: a body, a lock, an
  asteroid's layer, ink), the ray (a whole row), a shuffle, +5 moves; a held focus of 12 s makes the
  next one a pulsar to place. Moves running low make the next one +5 moves. Tools cost no move and
  carry into the next session (two). A full tray lets the light fall onto the board as a comet. This is
  the founder's rule: in the hard levels, focus earns the tools that finish them.
* **Rest — Cisza nocy (calm sky).** `calm` brightens the sky and the lens glows blue; every 4 s of calm
  a falling star lands — the first two leave comets on the board, the third gives two moves back —
  and the best move glows.
* **Blind — Zachmurzenie:** every 4th Obserwacja from the 3rd session clouds cover the lens; the tools
  gathered appear at the block's end.
* **The signal in sight.** The lens itself is the gauge: its light grows with `level`, a dashed ring
  at half its radius marks the threshold, gold above it; the charge ring round the rim and a violet
  hold arc. Round the lens's top runs the light trail — the last 40 s, a star a second, gold above
  the threshold, blue in rest, hollow without signal, veiled in a blind block. The runner's panel
  names it "Światło w obiektywie" (rest: "Jasność nieba"), the same quantity.
* **Bubo** talks in short bubbles (three variants a moment, never over the banner or a telegraph): the
  opening, a push block, a rest, a tool earned, a falling star, a near miss, out of moves, a big
  cascade, a hard level, a won level, three stars, a moon home, a blind block, a special, the dawn.
  Running jokes: he loses count, he wants cocoa, his grandma. The summary closes with his line.
* **Coach marks** (`env.hint`), once each: the first swap (pointing at the hint move), the goal
  card, a comet, a meteor, the telescope, the first tool, the rest; later sessions only what is new
  (clouds, moons, asteroids, locks, ink, a hard level).
* **Meta.** The saga map (the lobby's card and hero picture, the won card), the best stars of every
  level, the tools carried, the records per session length. Progress `ver: 2`; a version-1 save
  keeps its sessions, points and records and starts the new map from its first star.
* **Headline.** Points (`pkt`), the level or a cascade under it. **Closing:** a constellation
  complete: Isaiah 40:26; three stars: Genesis 15:5; a pulsar: Daniel 12:3; a long cascade: Job
  38:7; a tool from the telescope: 1 Corinthians 15:41; a passed rest: Jeremiah 31:35; falling stars:
  Philippians 2:15; else Genesis 1:16, Psalm 19:1, Psalm 147:4.

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

### 9.2 Dolina — the valley of the shadow (climb-out runner after Hell Escape, v2 → v3)

*Psalm 23:4 — "Even though I walk through the valley of the shadow of death, I will fear no evil."*
A pilgrim with an oil lamp climbs out of the valley floor by floor. Version 2 (2026-11-07) rebuilt
the game on Hell Escape's real loop — run, smash blocks with numbers, build stairs from what you
smash, climb, outrun the horde — and on the founder's request for a **double jump**.

* **The original, studied.** Hell Escape (Rollic): the weapon smashes blocks with hit points on
  contact; broken blocks give bricks that build a ladder of stairs to the next floor ("stair count"
  is an upgrade); weapon gates merge the weapon up and it resets each level; cages on the third stage;
  a horde follows and resets the level when it catches you; levels of three stages in worlds of
  ancient, medieval and future eras, ending at "guardians of time"; upgrades Stair Count / Add Weapon
  / Income; rebirth; energy, forced ads, paid "blessings". **Carried over:** the auto-strike on
  contact, blocks with numbers, stones → stairs, gates that merge, the weapon reset per level, pens on
  the third floor, the horde behind, three floors a level, three eras with a guardian, the three
  upgrades. **Adapted:** the catch is a stumble (oil, some stones), never a reset; cages hold lost
  lambs (Luke 15); "evolve" is the pilgrim's look. **Dropped:** rebirth, energy, ads, paid buffs,
  "gods and blessings" (§8.1), lanes (a side view jumps instead).
* **Hands.** Auto-run right. **Tap / Space / ↑ = jump; a second tap in the air = the double jump**
  (Ćma grabs his hood and flaps: a puff of golden dust, a flutter and a chirp); hold for the full
  height, let go early to cut it (×0.45); coyote time 0.1 s, a jump buffer 0.12 s; the air jump
  comes back on landing and on a stomp. ↓ / swipe down in the air = **stomp** (a block takes ×3, a
  shadow dies, the double jump returns). Heights are fixed so the levels can be drawn to them: one
  jump ≈ 1.7 u, both ≈ 3 u.
* **The sword strikes by itself** (every 0.19 s) at whatever is in front: a block (its number counts
  down, chips fly, hit-stop), a shadow, a pen, an open guardian. A block can instead be jumped (no
  stones) — a tall one only with both jumps.
* **A level** = three floors of road (pits narrow for one jump and wide for two; small, tall and
  paired blocks; the era's walker and its special; a low gate +1 under a high ring +2 that only the
  double jump reaches; pens: one on floor 2, two on floor 3). Each floor ends at a **ledge**: the
  stones in the pack fly out and become a stair at its foot (one step = 0.45 u); what the stair lacks
  is a jump, a double jump, or — after 1.3 s of standing there — a slow climb by hand. Floor 3 ends at
  the way out, a door of light: **stars** for the top, every lamb freed, and never caught by the
  tide. Every third level the third floor is a **guardian's arena**.
* **The eras** (three levels each, then round again, darker): *Babel* (Glinianek walks, Cegłomiot
  rolls bricks along the road — jump them), *Twierdza* (the soot squire, the crow at chest height),
  *Miasto* (the scroller pulls you back; the Pling floats at jump height — don't jump into it, stomp
  it from above). Guardians throw telegraphed things along the road: a low roll (jump), a wall (both
  jumps), a high beam (stay on the ground), a pair (jump, then jump again); then the **opening**: the
  weak point bows over him — the sword strikes, a double jump onto it hits ×3. *Wieża*, *Rycerz
  z sadzy*, *Ekran*; angrier at half light. A guardian comes only in a push block with ≥ 10 s left;
  at the block's end it withdraws, keeping its damage.
* **The tide of the dark** (the horde) follows at 4.3 u/s, never more than 16 u behind; hacking and
  climbing let it gain. Caught: Ćma flares the lamp — oil −0.2, 30 % of the stones spill, the tide is
  thrown back 9 u, the star is lost. Never a reset.
* **Push — the lamp's reach (sight).** After the lead-in (5 s Mendi, 2 s HALO) the reach is
  2.4 + level × 5.2 u: a circle of lamplight drawn on the world with the **threshold as a dotted
  ring** and the rim gold above it. In the light the fog lifts (numbers and pits show), shadows slow
  and above the threshold burn, the guardian's throws slow and it burns, and **the tide cannot come
  in — above the threshold the light pushes it back**. A held focus (5 s / 3 s) lights the **Świt**
  (up to 3 a block): every shadow in sight dissolves, every block bursts into stones, the tide is
  thrown 16 u back, a guardian loses 12 % and opens. The panel's gauge is the reach.
* **Rest — the meadow** (*Psalm 23:2*): the road ahead gives way to a meadow by still water (what was
  laid steps back and is laid again after it); no shadows, no tide. Calm gathers **smooth pebbles from
  the brook** (stones for the next stair, up to 12) and refills the oil; a passed rest: a full jar and
  +4 stones. The panel's gauge is calm.
* **Blind — Mgła:** every 4th push from the 3rd session; the lamp stays a small flame, at the end its
  last 15 s become one flash of that strength.
* **Grace.** Hits drain oil; at none he falls and rises with half (Micah 7:8). Ćma lifts him out of a
  pit. Nothing ends a run; the metres never go back.
* **Meta.** Sparks (blocks, shadows, lambs ×5, gates, levels 10 + 5/star + leftover stones,
  guardians, passed blocks, the day's gift) buy **Kamieniarz** (stones per block), **Kuźnia** (the
  sword a level starts with), **Sakwa** (sparks), **Knot** (the lamp), **Dzban oliwy** (less harm).
  The lobby shows the valley's map (levels with stars, guardian levels as diamonds), the looks
  (cloak → traveller → lamplighter → keeper of the dawn) and the lambs brought home. The next run
  starts at the next unfinished level. Progress is `ver: 2`; a version-1 save keeps its records and
  session count.
* **Teaching.** The first session's first floor is scripted — a narrow pit, a block, a wide pit, a
  high gate, a shadow, a tall block, a pen — and the coach mark (`env.hint`) names each control as it
  first matters, until it has been done (at most twice each). Later sessions explain only new things
  once ever: the tide, the meadow, a guardian, its opening, the fog, the Świt, a short stair.
* **Companion.** *Ćma*, the moth who loves the lamp a little too much and does the double jump's
  flapping ("Podwójny skok! Ja robię całą robotę, Ty zbierasz oklaski"): 32 moments, 3–4 variants
  each, never over a telegraph or a card.
* **Headline** metres; under it the level and floor, or "do rekordu 120 m". **Closing:** the first
  run Psalm 23:4; a lamb Luke 15:4-6; a guardian Romans 12:21; a fall Micah 7:8; a Świt John 1:5;
  five double jumps and a level Habakkuk 3:19; a long push Psalm 119:105; a passed rest Psalm
  23:1-3; else Psalm 139:12.

**Version 3 (2026-11-11): companions, the clock tower, gear — after the newest Hell Escape.** The
founder's verdict on the earlier Dolina was "boring / unclear"; v3 keeps the whole core above (run,
smash, stairs, double jump, the lamp, the meadow, Ćma, the eras, the guardians, the tide, stars) and
grows towards what Hell Escape became in 2026 (store page updated 2026-11-04, App Store "Firebound"
version history 1.8 → 1.13, ~35 reviews): companion slots ("three companions", sold for $16 there),
god skills Dash / Shield / Smite / Time Slow that "break barriers", collapsing bridges and spinning
blades, "boss and trial floors", gear tiers with a battle-power number, chests, "buff for 5 runs",
side challenges, and the Guild Tower climbed floor by floor. Everything the original sells is earned
by play here; nothing is bought, timed or ad-gated.

* **Companions (Towarzysze).** Six, each lost in the dark and freed from a **cage of smoke** that
  stands across the road (3.2 u: it must be broken) on the second floor of levels 1, 3, 4, 7, 10 and
  13, or on tower floors 2, 3, 6, 9, 12 and 16 (the first one past its mark, so an old save finds
  them one level at a time). **Slots:** one, plus one for each of the first two guardians beaten
  (keepers count). The lobby picks the party (a tap takes one along or leaves them at the camp).
  They run behind him, crowd in to **strike the block he is stopped at** (0.3 of his power every
  0.5 s, more by bond level), and each carries one power that **fires by itself** when its ring is
  full and it has something to do — the original's god skills, without gods:
  *Głaz* (a gentle giant afraid of the dark and of moths; he apologises to stones) — **Huk**, a
  mallet blow of 8 sword strikes on the block, shadow or open guardian ahead (level 3: the next block
  too); *Babcia* (a grandmother with a black umbrella; shadows are "hooligans") — **Parasol**, takes
  the next hit, even the tide's catch (level 3: two); *Bóbr* (a perfectionist engineer in a hard hat)
  — **Rusztowanie**, three wooden steps added to a stair as it starts (level 3: five; his stairs build
  twice as fast); *Zegarmistrz* (all his watches run five seconds late, "like your headband" — the
  band's delay told as a joke) — **Pauza**, 3 s in which shadows, throws, weights, the tide and a
  guardian move at 35 %; *Kozica* (a chamois who eats maps) — **Szarża**, charges 6 u ahead through
  shadows and small blocks and pushes the tide back; *Wiewiórka* (a squirrel who hides everything) —
  **Zapasy**, digs up three stones and gives back what the tide spilled. **Bond** grows with what
  they do together (a break 1, a kill 2, a power 4, a lamb 6, a level or tower floor 10) and is
  settled once per run; levels at 40 / 120 / 260 / 480 shorten the cooldown, and level 3 changes the
  power. They talk (one voice at a time with Ćma): a join line, three power lines, three quips, two
  level lines, and Ćma reacts to each when freed.
* **The band and the companions.** The lamp stays the gauge and the core. In a live push a power
  charges at ×(1 + above(level)) — up to twice as fast at the top: *they fight in your light*, gold
  rims and gold blows (×1.5) above the threshold. Never slower than ×1 without signal. In the meadow
  they rest: calm fills their rings (0.06/s at calm 1) and a passed meadow fills them all; a Świt
  fills them too. The registry's brain texts say so.
* **The clock tower (the second mode).** Opens with the first guardian; the lobby switches *Dolina /
  Wieża zegarowa*. The tower's clock stopped at midnight; every floor won moves the hands six
  minutes, floor 60 is 06:00 — the dawn (a great chest, then a darker night). Floors are short
  (26–38 u) and each is a **trial** (Firebound's trial floors): *Kamieniołom* (blocks for a tall
  stair), *Kładka* (planks that fall 0.32 s after they are trodden, one or two already gone), *Wahadła*
  (three clock weights swinging over the road: jump them low), *Galeria bram* (gates, then a giant
  block of 20 strikes — the merge pays off), *Owczarnia* (three pens), *Ciemnica* (thick fog: only
  the lamp shows the way — the band's floor), *Przypływ mroku* (the tide starts 7 u behind and 25 %
  faster). Floors 1–4 teach in order; later bands of four take four different trials in their own
  order; **every fifth floor a keeper**: Wieża, Rycerz z sadzy, Ekran and the tower's own
  **Kukułka** (a cuckoo clock: the minute hand sweeps at head height — stay down; the hour hand along
  the floor — jump; the weights — both jumps; its little door opens and the cuckoo is the weak point).
  The weapon starts over after each keeper. The next tower run starts on the floor not yet passed.
  The tower's inside is drawn as stone in candlelight with arched windows and the great clock showing
  the floor's time; its meadow is the terrace outside.
* **New things on the road.** Smoke curtains (from level 2): the sword and the companions' plain
  blows bite at half, powers and the Świt in full, and the lamp's light above the threshold burns
  them (a share of their light per second) — they pay 6 sparks and 2 stones. Plank bridges (from
  level 4). Swinging weights and giant blocks in the tower.
* **Gear (Rynsztunek).** Four slots — *Ostrze* (strikes 7 % faster a tier), *Płaszcz* (6 % less harm,
  10 % fewer stones spilled), *Sandały* (2 % faster), *Lampa* (the Świt's hold 5 % shorter, the brook
  5 % richer) — in six tiers named in craft words (Miedź, Brąz, Srebro, Złoto, Perła, Blask). Gear comes
  from **chests** opened at once (no timers): every guardian's and keeper's, every third mission's,
  the tower's dawn. A better piece is put on; an equal or lower one becomes shards, and shards merge
  into the next tier (3 × the tier), so a duplicate is never wasted. One **Siła** number in the lobby
  (the original's battle power) sums gear, upgrades, companions and the form. No "blessings" (§8.1).
* **Provisions (Prowiant)** for three runs, from chests: *Miód* (powers charge ×1.25), *Rodzynki*
  (sparks ×1.2), *Daktyle* (harm ×0.7) — the original's ad-gated "buff for 5 runs", earned instead.
* **Missions (Zadania).** Three on offer, each kind climbing its own ladder (break 25 → 90 stones,
  free 5 → 16 lambs, 8 → 35 double jumps, 3 → 12 high gates, stomps, a stair of 5 → 11 steps at once,
  tower floors, guardians, metres, companion powers, meadows rested in); never a band goal (half of
  people never gain reliable control). Done ones pay 25 + 10 a rung at once, and every third brings a
  chest.
* **Forms (the pilgrim evolves).** Six looks by sparks ever (0, 150, 500, 1200, 2600, 5000), each with
  a perk that changes the fight: *Wędrowiec* — a stomp shakes the ground (blocks and shadows within
  1.4 u take 2 strikes); *Lampiarz* — in a live push above the threshold the sword strikes 23 % faster;
  *Stróż świtu* — a Świt raises the next stair whole; *Przewodnik* — companions charge ×1.2, ten lambs
  follow; *Mistrz lampy* — the double jump's flap rings out and dissolves shadows and throws within 2 u.
* **New moments every session.** A cage on the road, a companion joining (a portrait card and their
  first line), a power's first firing, a slot opening, a bond level, a chest, a mission done, the
  tower opening, each trial floor's card, a keeper, the clock's hands moving — and the old ones.
* **Teaching.** Each new thing is explained once ever with a coach mark when it first comes into
  sight: a cage, a companion, a power, the tower, a bridge, a weight, a curtain, a chest.
* **Closing passages added:** a companion found — Hebrews 12:1 (the cloud of witnesses, running with
  endurance); three tower floors — Philippians 3:14 (the upward call); the clock's dawn — 1 Peter 2:9
  (out of darkness into His marvellous light); a lamp that nearly went out and did not — Isaiah 42:3
  (the smouldering wick); two passed pushes without a fall — John 8:12. The tower's story card quotes
  Philippians 3:14.
* **Save.** Progress `ver: 3`. A version-2 save keeps everything (records, sparks, upgrades, the map
  and its stars, lambs, guardians, what was explained) and gets the new fields fresh (the valley mode,
  the tower at floor 1, no companions yet — their cages stand on the next levels — no gear, three
  missions); a version-1 save keeps its records and session count; damaged fields are repaired.

### 9.3 Chleby — five loaves and two fish (crowd cannon after Mob Control, v3)

*John 6:9 — "Here is a boy with five barley loaves and two small fish. But what difference will
these make among so many?"* The hillside by the lake; the crowd sits at tables on the green grass.

The v1 (bread rolling up through gates to groups) read as a toy without a fight: nothing came back
down the hill and the screen did not say what to do. v2 copied Mob Control's loop mechanically (the
bullets below). v3 (2026-11-11) adds the depth Mob Control has in 2026 — the collection, the
champions, the helps, the boss arenas, the village, the league, missions, new lane elements — while
the band keeps the same two jobs (the part "Version 3" at the end of this section).

* **The original, studied** (store pages, Mistplay's guide, setup guides): hold to fire a stream of
  little mobs from a cannon at the bottom, drag to slide it; gates ×2/×3/+N, many of them moving;
  each mob multiplies once per gate; the enemy base at the top has an HP number; it sends red waves
  down, and blue meets red one for one; red giants are slow and worth many; a champion bar fills as
  you fire, full = a champion that tanks through; levels of several stages ending at boss bases;
  cannon rate, starting units, champions upgraded between levels. **Carried over:** all of that.
  **Adapted:** the enemy base is a table of the hungry (fed, never destroyed); the red waves are
  gulls; the giant is Gerwazy the fat gull and the boss is the Pelikan, who is *fed* until he waddles
  off; the champion is the Big Basket; cards become baskets of crumbs. **Dropped:** the lost level
  when enemies reach the cannon (a gull that gets there pecks the basket: the stream jams for 0.7 s),
  coins with an ad multiplier, energy, speed pads (in v2; v3 brings them back as pebble arrows, kept
  off the golden gate's row).
* **View and verb.** Behind the boy's basket, up a lane of worn earth in gentle perspective (the
  same on a phone upright, wider on a desktop, between the panel and the score on a phone on its
  side). **Hold** to pour a stream of bread-bearers — loaves on little legs, seen from behind,
  kicking — **drag** to aim; a tap (or Space) throws a handful of three (no faster than holding).
  Each runner feeds one; a fish (an upgrade) runs faster and feeds two; past 240 on the lane a gate
  makes runners heavier (a stack with a number) instead of more.
* **Gates.** Honey ×2 / ×3 (each runner once per gate; the first row's ×2 always slides), green +N
  (the first runner to touch it pops N more, then it recharges for 1.1 s), grey −N (swallows N, then
  breaks for 4.5 s; what it took becomes crumbs), and from level 1 rows of two side by side — a ×2 or
  ×3 on one side, a green or grey on the other: a choice. Bramka startowa (an upgrade) adds a ×2 by
  the basket.
* **The tables (the base).** A terrace has one table, or two side by side (aim left or right), each
  a group on a cloth with a hunger bar and its number; runners in the top rows steer to the nearest
  hungry table. All fed = the terrace is done; the boy climbs to the next one ("Wyżej!"). A level is
  one terrace, two from level 2, three from level 8; its hunger grows level by level and each time
  round the path.
* **The gulls (the waves).** A wave waddles down from the lake every 7 s (faster level by level),
  5 gulls and more, drifting toward the basket; a gull meeting runners snatches one loaf and flies
  off with it (the crumbs return to the bank). *Gerwazy* (from level 3, every 3rd wave) is worth six;
  *Mirka* herself leads a wave now and then (worth four — her post stands empty meanwhile).
* **The Pelikan (boss).** On the last terrace of each chapter's fourth level he walks down the middle,
  swaying, and gulps every runner he meets until his pouch (40 + 12 a chapter) is full; then he
  waddles off sheepish (two baskets). The terrace is hungrier.
* **The golden gate (push — Rozdawanie):** a wide arch in the middle of every terrace whose arch is
  the gauge: the band's level fills it from the left post, the threshold is notched at its top, and
  its number is the multiplier — ×1 below the threshold (never less), ×2 at it, up to ×5 high above
  it, in halves (fractions carry from runner to runner). Runners through it glow. `hold` (a held
  focus, 6 s Mendi / 3 s HALO) fills the **ring** around the boy's basket (pouring alone fills it
  slowly too, about once in a long stretch). Full, the next shot is the **champion** of the loadout —
  in v2 always the Big Basket, a giant basket on legs worth 30 that walks through gull waves and
  spills five loaves for each point of a gate's multiplier; in v3 any of five (below). The panel's
  gauge (`meter()`) is the gate's dial.
* **Rest — Na trawie** (*Mark 6:39-40*): the crowd sits down, no new waves come and the gulls on the
  lane doze where they stand (a runner only shoos one — "Sio!"); the golden gate dozes; `calm` fills
  **baskets of crumbs** — the row of twelve along the bottom fills one by one, and they go to the
  bank that buys the upgrades; a passed rest adds a full basket. The panel's gauge is calm.
* **Grace.** Nothing ends early and nothing is lost: after 40 s on a terrace the disciples help (the
  hunger falls by itself, faster and faster), pecks only jam the basket for a moment, snatched bread
  becomes crumbs, a session ending on a last terrace fed at least half way is finished by the
  disciples.
* **Levels, stars, the path.** Three stars within par (6 s + hunger / 22 a terrace, reachable with
  the golden gate working), two within 1.6 × par, one when the disciples helped. A level pays a
  basket, two for three stars. Chapters of four levels on six hillsides (the lakeshore, the green
  slope, the olive grove, the fishing village, the pasture, the hill at sunset), then round again
  hungrier; the card of a level fed shows the stars and the path's four stones; story cards open each
  chapter (the boy, his mother, the disciples counting, Philip and Andrew).
* **Upgrades** (v2; in v3 they are the village's first four buildings): Strumień (rate) → Piekarnia,
  Ryby (fish runners) → Przystań, Wielki kosz (worth and fill) → Wikliniarnia, Bramka startowa (a ×2
  by the basket) → Brama.
* **Teaching.** The first session teaches with coach marks, one at a time, when each first matters:
  tap → hold → drag, then the first wave, the golden gate at the first push, the Big Basket, the first
  rest; later sessions only what is new (the Pelikan, a grey or green gate).
* **Companion.** *Mewa Mirka* on her post, with the boy answering: the opening, every block, a
  wave of her family ("Szwagier, kuzynki, ciocia Halina…"), a snatch ("To nie kradzież, to
  degustacja!"), Gerwazy, a peck, the Big Basket, the Pelikan, a table fed, the help, a level, the
  evening; she finally gets a loaf of her own in the summary's last line.
* **Old saves** migrate in place (progress `ver: 3`): a v2 save keeps its path, stars, bank, records,
  story cards and coach marks, its upgrades become buildings, its collection starts with the four
  starter cards and a welcome chest, and its league starts at the tier its stars already reach (no
  back-pay); a v1 save keeps its records, sessions and people fed and starts the path again.

* **Blind — Mgła nad jeziorem:** the golden gate shows "?" in drifting mist and acts as ×1 while the
  block runs (the panel's gauge is hidden); at its end the block's last 15 s of focus pour out as a
  burst of runners at once.
* **The signal in sight.** The golden gate's arch-gauge and multiplier (live), the Big Basket's ring
  around the boy's basket (hold), the row of baskets of crumbs (calm). The runner's dock keeps the
  history, so the game draws no second chart.
* **Headline.** People fed (`nakarmionych`); the corner's second line is the level and terrace, or
  "do rekordu: N" when the record is in reach. **Closing:** the first session: John 6:9; a level fed:
  Mark 6:42-43; a champion sent: John 6:11; twelve baskets: John 6:12; a glutton sated: Matthew 6:26;
  a passed rest: Mark 6:39-40; two passed rests: Mark 6:31; a building raised: Micah 4:4; a jar
  opened: 1 Kings 17:14; a new card or a mission done: Matthew 10:42; else John 6:35.

**Version 3 (2026-11-11): Mob Control's depth, earned by play.**

* **The original in 2026, studied again** (the Play page updated 2026-11-09; the App Store history
  3.20–3.25.1 with Story Mode, Arena, base jobs, House of Champions, Kraken and Mobzilla boss levels,
  seasons; the fan wiki; setup and upgrade guides; two deconstructions; reviews). Its depth is a
  **loadout of four cards** — a cannon (Regular, Rapid Fire, Double, Shotgun, Lucky Shot, Big Bertha,
  Triple, Sniper, Flamethrower), a mob (fast and weak … slow and strong), a champion (Big Blob turns
  enemies into allies, Explodon bursts at a tap, Bumblebee is the fastest ram, Nexus and Giant Normie
  tank) and an ultimate (Mob Copter, Mass Abduct, Rocket Barrage, Rainbow Rage, Summon Gate) — each
  card levelled by copies with **glow-ups at levels 25, 50 and 75**; booster packs of rarities won in
  battles; a **base built by pouring bricks** whose level brings new units; **boss levels with their
  own layouts**; level elements (speed boosts, moving gates, traps); **championship stars** climbing a
  league to Immortal tiers; a season pass of quests; and raids, shields, revenge, clan races and dice
  events. Players love the crowd that snowballs and the champions; they hate the ads, the freezes that
  lose rewards and the pay-to-win. **Carried over:** the loadout, levels by copies with evolutions,
  packs won by play, the base, the boss arenas, the elements, the stars and the league, quests.
  **Adapted:** all of it into the feeding of the five thousand (below). **Dropped:** raids, shields and
  revenge (nothing is ever taken from the player), clans, dice and jackpots, the season pass, ads,
  energy, every purchase. The full list is in the builder's status file.
* **The loadout and the collection.** Four kinds of cards, chosen in the lobby (tap a card): the
  **basket** the boy pours from — *Koszyk mamy* (one by one), *Dwojak* (pairs), *Przetak* (a fan of five,
  more with evolutions), *Kosz z niespodzianką* (a golden loaf now and then, worth four), *Trojak*
  (left, centre, right in turn — the fastest), *Kosz rybacki* (slow; each runner a stack of three),
  *Piec* (while you hold and its embers last, warm loaves worth twice as much; the embers glow back
  slowly); the **bread** — *Bochenek* (balanced), *Bułka* (fast), *Placek jęczmienny* (slow, worth two,
  John 6:9's barley), *Podpłomyk* (flat: it slips under grey gates and the jar, the brook can't carry
  it), *Bochen* (slowest, worth three); the **champion** and the **help** (below). 21 cards in four
  rarities; a card's level (1–9) comes from its copies, each level adds 5 % to its main number, and
  **evolutions at levels 3, 6 and 9** grow its special (the fan, the luck, the embers, the spill, the
  donkey's reach, the giant loaf's burst …) and count a star in the league.
* **The champions** (the ring that a held focus fills sends the one in the loadout): *Wielki kosz*
  (tanks through and spills loaves at every gate), *Osiołek* (Big Blob: every gull he meets gets a
  crumb from his panniers and flies bread up to the tables instead of snatching it — Mirka: "Zdrajcy!"),
  *Wóz z chlebem* (Bumblebee: the fastest, shoos the gulls without losing a loaf, spills at gates, and
  stops a glutton for a moment), *Bochen olbrzym* (Explodon: tap it — or Space — and it bursts into a
  shower of loaves that run on through the gates above; each gate it passes first adds to the shower;
  it bursts by itself after 5 s), *Wielbłąd* (the camel: worth seventy, gulls bounce off him, a gate
  adds to his packs). The Wikliniarnia adds 15 % a level to every champion.
* **The helps** (Mob Control's ultimates): a round button low on the right of the lane (E or Enter)
  that fills with the people fed (≈ 90, less with the Studnia) and **at once with a passed rest** —
  *Mewy Mirki* (her family airlifts bread straight to the hungriest tables), *Sieć rybaków* (every gull
  flies off, the glutton stops), *Bramka uczniów* (a wide ×3 by the basket for ten seconds), *Wiatr od
  jeziora* (runners fly up the hill, walking gulls are blown back, no new wave). The player chooses
  when.
* **The gluttons' arenas** (boss levels): each chapter's last level ends on a terrace with its own
  layout and a guest who wants the bread — *the Pelikan* (sways down the middle and gulps; a jar on
  later circles), *Kozioł Zenek* (boulders split the lane into three columns with pebble arrows on the
  sides; he picks the column with the most bread, lowers his head behind a dust line, and charges —
  every loaf he meets rolls back down the hill, never lost), *Czapla Klara* (stands in a brook that
  carries the bread sideways and stabs what passes within reach; ripples show where she steps next;
  stepping stones are the quick way across), *Kormorany* (two brothers circle over the lake, a shadow
  on the grass darkens where one will dive and grab, then he sits drying his wings — the opening).
  All are fed until sated (a chest of cards, two baskets) and leave; in a rest they doze but still
  munch what runs into them; the disciples feed them too after 40 s, so every glutton leaves in the
  end. Chapters cycle Pelikan, Kozioł, Czapla, Kormorany; each circle round the path is hungrier.
* **The lane's elements**, one more every few levels, each taught once by a coach mark: pebble arrows
  (level 2: a sprint straight up), the **Dzban** (level 5: a jar gate that drinks loaves until it is
  full — they become crumbs — then opens as ×3 for eight seconds), boulders (level 7: the crowd parts
  around them), the brook (level 9: it carries runners sideways except on its stones), honey ×4 gates
  (level 10: narrow and fast).
* **Bundles** (booster packs, never bought): a level fed pays a *węzełek* (2 cards), three stars a
  *tobołek* (3, the last rare or better), a glutton sated or a new league tier a *skrzynka* (5, the
  last epic or better), a mission a *tobołek*. Odds are published in the lobby (common 64 %, rare
  26 %, epic 8 %, legendary 2 %, tipped by the Spichlerz); a bundle's first card is a card never found
  with even odds; an epic comes at least every twelve cards; a copy past the top becomes crumbs. A
  bundle opens into the collection the moment it is earned (saved even if the session ends) and is
  revealed at the next break, everything earned since the last one together (the best first, at most
  eight tiles, the last saying how many more): the cards turn over with their rarity, "Nowa!", their
  level, "Ewolucja!"; a tap shows them all at once (never in the first moment, so a tap meant for the
  basket never skips it), and a story card over the reveal holds it.
* **The village — Betsaida** (Mob Control's base), built between levels (the village card, at most
  every 60 s) and in the lobby with the baskets of crumbs (a basket fills with 12 s of calm; the six
  buildings' 20 levels cost 516 baskets — a strong player finishes the village in about ten
  five-minute sessions, by the balance probe): *Piekarnia* (the stream), *Przystań* (a fish
  every few runners, worth one more), *Wikliniarnia* (the champions), *Brama* (a ×2 gate by the
  basket), *Studnia* (the help fills quicker), *Spichlerz* (a bigger day's gift, more Posiłki, luckier
  bundles). The village's level (all buildings, 0–20) brings new cards into the bundles' pool, as Mob
  Control's base level brings new units; the lobby draws the lakeshore with what is built.
* **The league of stars** (Mob Control's Champions League): stars from the levels (the best of each,
  up to three), one per building level and one per card evolution; the tiers are named after the
  feeding — *Garść*, *Pięćdziesiątka*, *Setka*, *Tysiąc*, *Pięć tysięcy*, *Dwanaście koszy* (Mark
  6:40, John 6:13) at 0, 15, 40, 80, 140 and 220 stars, then *Dwanaście koszy II, III …* every 70
  stars; each new tier pays a chest.
* **Missions** (quests without a pass): three at a time, of different kinds (feed N, loaves through
  the golden gate in a Rozdawanie at any multiplier, champions sent, gulls stopped, stars, helps used,
  rests on the grass, a glutton sated, a building raised), growing with the missions done; each pays a
  *tobołek*. None needs the band to be completed; the band makes some quicker.
* **The day** (date-seeded, the same for everyone): an ordinary day, a breezy day (runners faster), a
  market day (a card more in every bundle), Mirka's family reunion (more gulls, double crumbs), a good
  catch (every fourth runner a fish), a quiet morning (gulls later and rarer); a banner at the start.
* **Posiłki** (Mob Control's reinforcements): a handful of loaves pours out by itself as each terrace
  begins (more with the Spichlerz; not in the very first lesson).
* **The band is unchanged:** the golden gate's multiplier in a Rozdawanie (the panel's gauge), the
  ring's held focus that sends the chosen champion, calm on the grass filling the baskets of crumbs
  (now the village's bricks) and a passed rest readying the help; the blind Mgła as before. The cards,
  the village and the league never make a band-driven quantity depend on purchases or on the signal
  alone: every card, building and tier is reached by playing, with the band adding size and speed.
* **Teaching (v3):** once each, when first met: the help ("stuknij przycisk w rogu"), the first
  bundle, the jar, the brook, the pebble arrows, the boulders, the ×4 gate, each glutton, the giant
  loaf's tap, the donkey, the cart and the camel. Story cards: a glutton's first arena, the village
  (Betsaida) at the first building, the bundles at the first reveal.
* **Companion (v3):** Mirka gains 25 moments (3 lines each in four languages): each glutton's arrival
  and leaving, the goat's charge, the heron's stab, the cormorants' dive, each champion, the donkey's
  gulls ("Kuzynka Zdzisia niesie chleb na stół. Nie poznaję jej." — and the boy: "Mirka, oni po prostu
  lubią pomagać."), the giant loaf's burst, the help ready and each help, a bundle, a new card, an
  evolution, a league tier, a mission, a building, the jar.

### 9.4 Jerzy i smok — the knight on the dragon's lands (survivors-like, v2 → v3)

*Ephesians 6:16 — "Take up the shield of faith, with which you can extinguish all the flaming
arrows of the evil one."* The legend of Saint George: the dragon's brood crawls over the kingdom's
fields, a princess refuses to wait in her tower, a knight walks out with a shield. Rebuilt in v2
(§10.5) after *Knight Survivor* and its genre (Vampire Survivors, Survivor.io, Archero), grown in v3
(§11.3, 2026-11-11) towards the newest Knight Survivor: the mechanics are the genre's, the world,
names, art and numbers are ours.

* **View and verb.** An endless top-down field of the current land (meadow, marsh, stony pass,
  castle grounds, and in v3 the ash hills and the golden hoard), the camera on the knight. **A drag
  anywhere is a floating joystick** (WASD and the arrows too). His weapons strike **by themselves**.
  A tap without a drag does nothing — except release a ready Miecz światła, pick a card, reshuffle the
  cards or close a card — so the smoke's centre clicks are harmless and the auto-sword still gathers
  scales.
* **The brood** (the dragon's creatures, round-eyed and a little comic): *pisklę* (a chick, the
  chaser), *jaszczurka* (fast lizards in packs), *plujka* (a toad-dragon that keeps its distance and
  spits fireballs), *pancernik* (an armoured plodder), *ognik* (ember beetles in swarms), and golden
  *elites* that leave a chest. They come from beyond the edge of sight in a stream that thickens with
  the run, a ring closing in every 30 s, an elite every 50 s; the first seconds of a run they hatch
  from burrows within sight. Beaten, they **dissolve into ink-grey smoke and sparks and scamper
  off** (§8.1), leaving a **scale** (bronze 1, silver 2, gold 10). Apples heal; a rare gust pulls in
  every scale.
* **Levels and cards.** Scales are experience; every level freezes the world for **one of three
  cards**, and **each card shows its numbers** ("Cięcie 5 · co 0,92 s · zasięg 2 m"). Nine weapons:
  *Miecz* (the sweep he starts with), *Kopia* (piercing lances), *Sokół* (falcons circling him),
  *Wiadra giermka* (splashes that also put out fire), *Róg* (a ring that throws the brood back),
  *Biały koń* (charges across the field), and in v3 *Młot* (thrown out and back, striking both
  ways), *Kusza* (quick bolts at the strongest: an elite, the dragon) and *Kolce* (caltrops dropped as
  he goes, which bite and slow). Nine pieces of gear: *Sztandar* damage, *Rękawice* cooldown, *Buty*
  speed, *Tarcza* the aura's base, *Zbroja* hearts lost, *Sakwa* pickup, and in v3 *Kołczan* (+1/+2
  projectiles), *Płaszcz* (reach and size) and *Pierścień* (critical blows ×2, gold numbers). Four
  weapon and four gear slots; weapons to 5, gear to 3; a companion's level is a card too. **Evolutions:**
  a weapon at 5 with its pair at 3 evolves from the next chest or as the first card (*Miecz Jerzego*,
  *Grad kopii*, *Sokoły króla*, *Źródło*, *Róg grzmotu*, *Biała szarża*, *Młot kowala*, *Kusza
  królewska*, *Żelazna łąka*). **Duets** (v3): two weapons that belong together change each other —
  *Turniej* (lance + horse: charges +60 %), *Pobudka* (sword + horn: after a blast the sweep goes all
  round), *Ulewa* (buckets + horn: the horn's ring puts out fire), *Łowy* (falcon + crossbow), *Zasadzka*
  (caltrops + horse: caltrops along the lane), *Kuźnia* (hammer + sword); a card names the duet it
  would form. **Linda reshuffles** the cards once a run (twice more from the forge): the button under
  them, or R.
* **The land's dragon (the boss).** On the second Tarcza block of a session (once it is 30 s old), and
  every other one after, the land's dragon flies in. **Telegraphs** on the ground in red, then the attack, then a
  **dizzy window** (stars, ×2). Each third of his scales: a roar, a push and a chest. At the block's
  end he **flies off for a nap** and keeps his wounds — across runs and sessions. Driven off (never
  killed), he flies over the hills: a big chest with his hoard's treasure, gold scales, a story card,
  and the next fight. **Each dragon has a fatal flaw** (v3, Knight Survivor's "a chess match against
  dragons with unique weaknesses"): a longer window (3.6 s) at ×3 that the player learns to bring
  about. Linda hints at it until it is found; found, it goes into the **Księga smoków**:

  | Land (town) | Dragon (scales on the squire's road) | Attacks (+ from the knight's road) | Fatal flaw | Hoard |
  |---|---|---|---|---|
  | meadow (Silena) | Zielony (2 400) | breath cone, fire lanes, fire rain (+ tail sweep) | **Kaszel**: ≥ 6 flames of one breath put out (by the shield, water, Iskierka) — he chokes on the steam | Lusterko Lindy |
  | marsh (Trzcinowo) | Bagienny (3 000) | **dive** under the turf to a marked ring, rain, breath (+ lanes) | **Grzęzawisko**: his dive misses — stuck in the mud | Dzban ze źródła |
  | pass (Skalna Przełęcz) | Skrzydlaty (3 600) | swoop, rain, breath (+ lanes) | **Twarde lądowanie**: his swoop misses — he hits the rocks | Sokole pióro |
  | castle (Królewski Gród) | Trzygłowy (4 300) | rounds of three different attacks, one per head (+ ring) | **Splątane szyje**: after every round of three | Klepsydra |
  | ash hills (Kuźnica) | Żarowy (5 000) | **ring of fire** closing in with a gap, **embers** (beetle packs), breath (+ rain) | **Przegrzanie**: while he cools after the ring, the aura or water touches him | Krzesiwo |
  | the hoard (Złotniki) | Złoty (5 800) | **hot coins** in a fan (those that miss cool into scales), **tail sweep** (knocks scales out of his hoard), swoop (+ rain) | **Łakomstwo** (×2.5): ≥ 4 scales lie near him — he stops to gobble them | Mapa skarbów |

* **The roads** (v3, Knight Survivor's "adventure replayed on higher difficulties"): every land is
  fought on the squire's, the knight's, the hero's and the legend's road (and beyond): the dragon's
  scales ×1 / 1.6 / 2.3 / 3.1 (+0.8 a road after), the brood ×1 / 1.3 / 1.65 / 2, quicker telegraphs,
  from the hero's road two attacks in a row, and a **treasury bonus** of 25 / 50 / 75 % of the
  session's scales. The map shows a crown for every road cleared; the next fight is the frontier (the
  lowest road with a land left), or, picked in the lobby, any freed land's next road; a dragon left
  wounded keeps his wounds per land and road.
* **The shield's aura (push — Tarcza):** the band is a ring of light around Jerzy. In a sighted Tarcza
  past its lead-in (5 s Mendi, 2 s HALO) its radius = base + `level` × 2.8 u; the **threshold is a
  dotted ring** drawn on it (named "próg"), the rim turns gold beyond it. It **beats** every 1.35 s,
  throws the brood inside it back, and in v3 the beat grows with the aura (×1…×3) and strikes the
  dragon when he is inside it; **fire inside it goes out** (steam) — fireballs, hot coins, the
  breath's flames, rain, above the threshold the fire lanes under him, and a **whole ring of fire**
  the aura reaches. Quenched fire and a held focus charge the **Miecz światła**; a tap (or Space; by
  itself after 6 s) releases it: light over the whole screen, the brood dissolves, the dragon loses 8 %
  of his scales (at most 240). The push block is also the wave's peak (more spitters: more fire to
  quench). Two weak spots are the shield's own: the Green Dragon chokes on a breath the shield puts
  out, the Ember Dragon collapses when the aura touches him as he cools. The base hugs the knight
  (gear and the forge widen it) — without the signal the game plays at its base, never a penalty.
* **Rest — Postój:** the dragon and his brood **nap** (spawns ×0.3, the creatures drowsy, "z" over
  their heads, a blue dusk; Burek and Bartek nap too); `calm` brings hearts back; the block's end gives
  a **free card**, golden (two levels, and sometimes a treasure) after a calm one.
* **Blind — Dym:** the aura is drawn as smoke and stays at its base; the footprints are grey; at the
  block's end its share of time above the threshold fills the Miecz światła at once.
* **The signal in sight.** The aura's ring (live) with its threshold ring, the sword's dial and the
  blade's glow, and the history on the ground: **footprints** for the last 40 s, gold where the
  signal was above the threshold (blue for a calm rest). The runner's panel names the gauge *Tarcza*
  (*Siły* in a rest).
* **Grace and runs.** Five hearts; contact nibbles, fire bites. At none, Linda's apple gets him up
  once a run (half hearts, the brood thrown back). After that the **run ends**: a tally (scales,
  time, level, "12 łusek do rekordu biegu", and in v3 **what each weapon did** — the stat screen
  Knight Survivor's players ask for), and a new run starts at once; the session's scales stay.
* **Companions** (v3, Knight Survivor 1.2's companion system; unlocked by play, never bought; one
  comes along, two after three dragons): *Burek*, the town dog (after the first session: fetches scales
  and chests beyond reach, bites, barks before a telegraph so it lasts 0.25 s longer); *Iskierka*, the
  Green Dragon's youngest, who changed sides (the first dragon driven off: eats fire near her —
  it charges the Miecz — and spits sparks); *Kolczak*, a hedgehog (8 chests: rolls round the knight in
  a ball of spikes and brings the scales it picks up); *Bartek*, a beaver (the Marsh Dragon driven
  off: gnaws palisades that hold the brood and stop fireballs). Each has levels in the run (cards).
* **Treasures of the hoard** (v3, the original's relics "+30 % dmg to x", shown on the weapon they
  touch): twelve run modifiers — the hoard of each dragon's first drive-off, and from elites' and
  roars' chests (30 % / 50 %): *Lusterko Lindy* (quenched fire throws light at the brood), *Dzban ze
  źródła*, *Sokole pióro*, *Klepsydra* (windows ×1.5), *Krzesiwo* (the Miecz charges 30 % faster),
  *Mapa skarbów*, *Złota podkowa*, *Osełka*, *Kowadełko* (evolve with the pair at 2), *Szczepka jabłoni*,
  *Kompas*, *Ogniwo kolczugi*; the treasury in the lobby keeps the ones found.
* **Meta.** The **treasury** keeps every session's scales (plus the road's bonus); the **forge** (in the
  lobby, prices 1, 3, 6, 10, 15 × the first) turns them into permanent upgrades (Siła, Serce, Krok,
  Zręczne ręce, Osłona, Nauka, and in v3 Talia Lindy — reshuffles — and Druh — companions start a level
  higher); the **armoury** gives the knight's gear for milestones (the Silena pennant, a plumed helmet,
  silver spurs, a purse belt, Linda's basket, the sun shield, and in v3 the victor's wreath — a land
  won on the knight's road — and vambraces — six treasures); the **map**: six lands × roads with
  crowns; the **Księga smoków**; the companions; the duets found.
* **Story.** The opening card (the first session, with Ephesians 6:16), a card for every land freed
  with the road won and the next fight (the first one: Iskierka stays with Linda), Linda's closing line
  in the summary.
* **Companion who talks.** *Księżniczka Kleodolinda* (the legend's name, which she hates; "mów mi
  Linda"): clever, sarcastic, warm; she trots behind him and talks in short bubbles — 41 moments × 3–4
  lines: the opening, a block start, a good push, a quench, a near miss, a level, an evolution, a
  chest, an elite, a wave, the dragon, his dizzy window and nap, the apple, a run's end and a new run,
  the ending, and in v3 a weak spot found ("Szach! A teraz mat, rycerzu."), a treasure, a duet, a
  reshuffle, a harder road, three hints for each dragon's weak spot, and lines about each companion.
  She keeps quiet while the runner's coach mark is on the field, and a hint that came true is cut.
* **First session.** A warm-up (no blocks: the joystick and the sword) and coach marks one at a time
  when they first matter: drag to walk, scales, the first card, the aura and its threshold, a
  fireball to quench, the sword ready, the Postój, the dragon's red shapes, a chest, an evolution; in
  v3 also the reshuffle, the companion, a treasure, a duet, a weak spot, the ring of fire. Later
  sessions get a mark only for what is new to the player.
* **A phone on its side** (v2's cramped layout): the hearts, the level's bar and the dragon's bar move
  into the free strip between the runner's panel and score, the field is drawn smaller so the widest
  aura fits, and cards, the tally and the story cards sit under the runner's panel.
* **Pacing, checked by simulation** (`test/arcade-jerzy.test.ts`, "pacing table", `JERZY_BALANCE=1`):
  a bot plays careers of sessions on one save (sharp: every telegraph dodged; casual: slower, misses a
  third of them) with no signal, an average and a good focus. v2's numbers let a sharp bot reach level
  29 in 5 min without losing a run, buy the whole forge after one session and drive a dragon off in
  ~10 s of his visit. v3 retuned the stream (slower growth, smaller packs), the level curve (5 + 6k +
  1.8k²), the brood's growth, the dragon's scales (×4.6), the forge's prices, and gave focus more
  weight. Now a casual player with an average focus: 3 min — ~860 scales, level ~11, a dragon every
  second session; 5 min — ~2 000, level ~15, about one dragon a session (the first in session 1–2),
  ~3 weak spots opened; 10 min — ~6 000, level ~23. Focus adds +40–100 % to a visit's damage on the
  dragon and keeps the knight standing (no signal: ~1.5 runs a 5-min session; average focus: ~1).
  The squire's road takes ~25 minutes of play; the roads beyond, weeks of daily sessions.
* **The save.** Progress `ver: 3`. A v2 save is migrated in place: the bank, the forge, the armoury,
  the records, the counters and the coach marks stay; the old four-land map index becomes roads
  cleared on the six-land map (with the wounds of the dragon it was fighting); a knight who had gone
  round once meets the two new lands first; the companions earned are given at once. A v1 save keeps
  its records and session count.
* **Dropped from the original:** energy, ads (revives, rerolls, resources all ad-gated there), paid
  packs, the battle pass and the wheel, loot boxes, weapon rarities (players hate the gap between red
  and the rest), RNG walls (nothing is lost: a dragon keeps his wounds).
* **Headline.** Scales gathered in the session (`łusek`); the line under it: the level and the run, or
  "N do rekordu biegu". **Closing:** the first session: Joshua 1:9; a dragon driven off: Psalm 91:13;
  a weak spot found for the first time: James 1:5; a Miecz światła: Ephesians 6:17; many fires
  quenched: Ephesians 6:16; new armour or an evolution: Ephesians 6:10-11; a long stand: 2 Timothy
  4:7; a calm Postój: 1 Corinthians 16:13; else Ephesians 6:16.

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

## 11. Version 3: seven games after seven originals, studied in depth

On 2026-11-11 the founder named seven mobile games and asked for each to be studied deeply, with the
newest information, and for the mechanics of each to be copied thoroughly, with the Mendi reading
either an extra layer of the mechanics or, better, the core of the game; and for all of them to be
fun and entertaining, with storytelling and the other things that make games successful:

| Original (store, 2026) | Ours | Scope |
|---|---|---|
| Hell Escape (Rollic) | Dolina | expand v2 → v3 (§9.2) |
| Mob Control (Voodoo) | Chleby i ryby | expand v2 → v3 (§9.3) |
| Knight Survivor (Mobibrain) | Jerzy i smok | expand v2 → v3 (§9.4) |
| XP Hero (Supercent) | **Dawid** | new (§11.6) |
| Hero Wars: Alliance (Nexters) | **Dziewiątka** | new (§11.7) |
| Lordrush (Century Games) | **Nehemiasz** | new (§11.8) |
| Idle Cat Gunner (Neptune / Treeplla) | **Kocia straż** | new (§11.9) |

The rules of §10 hold for all seven: the standard HUD (§10.2), the toolkit (§10.3), the band as the
core (§10.4), the originals' mechanics copied as closely as they serve play while names, characters,
art, music, levels and look stay our own (§10.1), and the faith and reverence rules (§5, §8.1, §9.1,
§11.5). Every builder researches its original again in this round, from the store page, the newest
updates, guides, wikis and reviews, and writes the list of mechanics (carry over / adapt / drop) into
its status file before it writes code; the design sections below are the direction, and each builder
rewrites its own section with the full design.

### 11.1 What the originals are, in 2026

* **Hell Escape** (updated 2026-11-04): a runner with hack-and-slash through three eras of a dark
  world; blocks with hit points break into stair pieces that build the climb to the next floor;
  weapon gates; a horde behind; guardians of time with patterns; evolve between runs. New since v2:
  **companion slots (up to three companions fight alongside)** and a **tower** to climb floor by floor
  (the guild tower rework), buffs for a number of runs, gear. Players praise the progress of "one more
  floor"; they hate energy, forced ads and paid slots.
* **Mob Control** (monthly content): hold to pour a crowd from a cannon, drag to aim, multiplying
  gates, enemy waves and bases, champions when the bar fills. Its depth is a **card collection of
  cannons, mobs and champions, each with levels and evolutions**, booster packs won in battles, a
  **base the player builds** (and others raid for bricks; revenge attacks), **boss levels with
  unique layouts**, championship stars and a league, a season pass.
* **Knight Survivor** ("Princess' Knight"): survivors-like dragon fights, "a chess match" against
  dragons with unique patterns and fatal flaws, one of three skills at a level, weapons that evolve,
  an **adventure mode replayed on higher difficulties**, companions (since 1.2), gear and relics.
* **XP Hero** (Supercent, 10M+, updated 2026-10-20): an action RPG on an open world map. The hero
  (and up to five more heroes in the team) walks the map and strikes automatically; monsters respawn
  at their spawn points; **20 stages in 3 regions, each locked behind one boss gate** (the boss of the
  previous stage); an 850-quest main chain handed out by named NPCs; gold buys abilities in a steep
  ladder (power, health, critical chance, attack speed, double/triple attack, life steal); a smithy
  crafts weapons in 6 categories (swords, daggers, morningstars, crossbows, wands, guns) with
  evolution trees; 26 heroes in rarities with a 1–6★ star ladder from hero pieces, each with one kit
  skill that fires every few seconds; runes; a base of buildings (bonfire, smithy, chest house,
  portal…); a 250-floor Challenge Tower; gift chests, a treasure goblin, level-up rewards every five
  levels, idle hunting. "Progress = bosses; everything else is fuel." Players love the satisfying
  sounds and the level-ups, and complain about forced ads after bosses.
* **Hero Wars: Alliance** (Nexters, 100M+, ten years old in 2026-11): collect heroes (80+, six
  factions), set a team of five, and they fight by themselves on a side-view field; each hero fills
  an **energy bar** by attacking and being hit, and **the player taps a hero's portrait to fire its
  ultimate** when the bar is full (or lets auto do it); front line, back line, support, control,
  damage, defence; a **campaign of chapters and missions with three stars**; heroes grow by levels,
  skills, **colour ranks earned by six pieces of gear**, **stars from soul stones**, artifacts,
  glyphs, skins and pets; the **Tower** (floors, chests, a shop of buffs, heroes' health carried from
  floor to floor); titans, adventures, arena, guild wars, Legends Draft. Its ads famously show a
  puzzle game it is not; the complaints are pay-to-win.
* **Lordrush** (Century Games, 2026): medieval tower defence and fortress building. The ads (and the
  first days) are a defence game in the spirit of Thronefall: a lord walks the ruins, stands on build
  spots to raise walls and towers with wood, stone and iron, recruits heroes, and holds the night's
  assault along the enemies' routes; the full game adds a settlement (survivors assigned as workers,
  hunters, cooks; food, health and order; decrees) and a 4X map with alliances. Players praise the
  look and the gentle learning curve, and resent that the tower defence the ads promise thins out.
* **Idle Cat Gunner** (Neptune, updated 2026-11-06): an idle shooter. A squad of cats auto-fires at
  waves coming down a stage; the player only upgrades (attack, attack speed, coin income), equips
  guns by drag, and **merges two guns of the same grade into a random gun of the next grade** ("the
  most addictive mechanic"); 25+ cats with personalities and abilities, 35+ guns, maps from forest to
  snowfield with bosses, **rebirth** for permanent power at milestone stages, offline rewards, raids,
  enhancement stones for slots.

### 11.2 The four new games, in one table

| | Dawid | Dziewiątka | Nehemiasz | Kocia straż |
|---|---|---|---|---|
| Kind (Games tab) | arcade | strategy | strategy | strategy |
| Story | the shepherd boy of Bethlehem grows into a king: the lion, the bear, the giant of Gath, the harp for Saul, the cave of Adullam | the town of Zacisze is drowned by Zgiełk (the Din); nine heroes named for the fruit of the Spirit (Gal 5:22-23) hush it | the wall of Jerusalem rebuilt in 52 days (Neh 6:15): building by day, the watch by night, Sanballat and Tobiah sneering | the abbey's cats keep the vineyard from "the little foxes" (Song 2:15), the granary from mice, the grapes from sparrows |
| Mechanics carried over | open map of zones with respawning beast camps; auto-strike; XP and huge level-ups; boss gates between lands; NPC quest chain; gold → ability ladder; weapons by category with crafting and evolution; a party of companions with kit skills; a camp of buildings; a cave tower of floors | five heroes auto-battle on a side-view field; energy from hitting and being hit; tap a portrait for the ultimate; front/back roles; campaign chapters with 3 stars; levels, colour ranks from six pieces of gear, stars from shards; a tower with a buff shop and health carried over | walk the lord; stand on markers to build and upgrade walls, gates, towers and houses with stone, wood and iron; recruit and deploy heroes; waves at night along routes; assign people to jobs; food and health; decrees; days as the campaign | a squad of cats auto-fires at waves coming down; upgrades (attack, speed, income); equip by drag; merge two of a grade into the next; cats to collect; maps with bosses; rebirth; offline rewards |
| Push (focus) | **the sling's whirl**: the ring around David spins; above the threshold the stones fly golden with a multiplier on damage and XP (×1…×4); a held stretch sends the great stone from the brook (one of five smooth stones, 1 Sam 17:40) | **energy**: the team's energy bars fill ×1…×3; a held stretch fills **Harmony**, all five ultimates in one chord | **the watch fires** (reach/sight): the light along the wall widens; towers and guards hit what stands in it; a held stretch blows **the ram's horn** (the shofar): everyone rallies to one spot (Neh 4:20, told in a card) | **alertness** (multiplier): the cats fire ×1…×3, their eyes turn gold; a held stretch starts **the Great Hunt** (every cat pounces) |
| Rest (calm) | **the harp by the fire** (1 Sam 16:23): the party heals, beasts nearby doze, wool and gold come in | **a rest by the fountain**: wounds heal; the end offers one of three boons | **a working day**: the builders' rhythm raises and mends the wall and fills the granary and the stone yard (night = push block, day = rest block) | **a nap in the sun**: the grapes ripen into income, a new toy turns up in the chest |
| Blind push | a moonless night on the hills | a fog of noise | a moonless night | dusk |
| Headline | XP (pl/en/sv), EP (de) | uciszonych / hushed / besänftigt / tystade | łokci / cubits / Ellen / alnar (of wall raised) | szkodników / pests / Schädlinge / skadedjur |
| Companion who talks | a lamb David pulled from the lion's mouth | a bell-ringer child of the town, or the heroes' banter | one of Shallum's daughters, a builder with a trowel (Neh 3:12) | an old brother of the abbey who loves his cats |
| Root | 1 Sam 17:37 | Gal 5:22-23 | Neh 2:18 | Song 2:15 |
| Closing passages | 1 Sam 16:7, 16:23, 17:40, 17:45; Ps 23:1-3 | Prov 16:32, Jas 1:19, Col 3:14, 1 Cor 13:7, Eccl 3:7, Rom 12:21 | Neh 2:20, 3:12, 6:3, 6:15, 8:10; Isa 58:12 | Prov 27:18, 12:10; Isa 11:6; Job 12:7; Prov 6:6-8; Mat 6:26 |

The headline must accrue live and is the same number as `result().score`.

### 11.3 How the three v2 games grow (v3)

Each keeps its core and its save (progress `ver: 3`, migrated in place) and takes the original's
depth that v2 left out:

* **Dolina** (§9.2): companions who run and fight alongside (up to three slots, unlocked by play, not
  bought), a tower of floors to climb as a second mode, deeper evolution and gear, and whatever the
  newest Hell Escape does that serves play.
* **Chleby** (§9.3): a collection of cannons, crowds and champions with levels and evolutions (cards
  won by play, never bought), boss levels with their own layouts, the village the player builds, a
  league of stars, more champions with distinct abilities.
* **Jerzy i smok** (§9.4): adventure difficulties to replay, companions, relics, more dragons with
  their own fatal flaws, the pacing and dragon health checked by simulation over many sessions.

### 11.4 Shared rules this round

* The four new games are built from the newest architecture (rules / sim / content / meta / view /
  intro / preview / panel / audio / i18n / index, §10, as in `aniol/`, `jerzy/`, `dolina/`).
* **No paid anything, no energy, no ads, no gacha.** Random merges and chests are fine (the play's
  own luck), never bought. Offline rewards (Kocia straż) are modest and capped.
* Every game teaches itself in the first session with coach marks (§10.2), and every session can be
  3, 5 or 10 minutes: the moment loop, the level loop and the meta loop must all pay out inside 3
  minutes as well.
* Strategy games (Dziewiątka, Nehemiasz, Kocia straż) still answer the smoke contract: a centre tap
  or Space every so often must do something useful (fire the next ready special, build at the
  nearest marker, merge the first pair), and the headline must rise within 22 s with focus on.

### 11.5 Reverence for the four

* **Dawid.** David is a boy and a shepherd, then a king; he is never prayed to, and his strength is
  never "power from God" on a meter. Beasts are beasts: struck, they run off into the hills; nothing
  dies on screen, no blood. The giants of Gath are bosses: Goliath falls flat and the Philistines run
  (1 Sam 17:51-52), the stone and the fall are shown, nothing after. Ordinary Philistine soldiers are
  not enemies to fight. The harp is the rest, never a weapon. `1sa17.34-35` (the lion and the bear)
  ends with David killing them: use it only as a story card's quotation, never under a scene that
  shows it.
* **Dziewiątka.** The heroes carry the names of the fruit of the Spirit (Galatians 5:22-23) as an
  allegory in the old tradition of the virtues against the vices; they are characters, not the Holy
  Spirit, and nothing in the game is "power of the Spirit". The vices are shadows of noise (§8.1):
  ink, static and smoke that dissolve into quiet; they are comic, never cruel. No "faith" hero:
  Faithfulness (*wierność*) is the virtue's name.
* **Nehemiasz.** The raiders are men: struck, they lose heart and run (Neh 4:15); no one dies on
  screen, no blood. Sanballat and Tobiah are comic villains who sneer and scheme, never monsters. The
  horn is a ram's horn (the shofar), not the angels' trumpet (Zastępy's symbol); Jerusalem's ten gates
  of Neh 3 are this game's, Zastępy keeps its two gates of the hosts. God is never shown; the story
  cards quote Nehemiah's prayers only as story.
* **Kocia straż.** Cute and gentle: the cats shoot peas, water, yarn and seeds; pests are startled and
  run off, never hurt. The abbey's brothers are warm and funny, never mocked for their faith. No
  wine-drinking jokes; the vineyard's grapes are harvested and that is all.
* **Exclusive symbols.** The sling, the harp, the five smooth stones and the giant to Dawid; the nine
  heroes, the Din and the bell of Zacisze to Dziewiątka; the wall of Jerusalem, its ten gates, the
  watch fires and the ram's horn to Nehemiasz; the abbey cats, the vineyard and the little foxes to
  Kocia straż. Sheep stay Pasterz's (David's flock is in the background, never the play's crowd).

### 11.6 Dawid — the shepherd who becomes a king (open-world action RPG after XP Hero)

*1 Samuel 17:37 — "The LORD, who delivered me from the claws of the lion and the bear, will deliver me
from the hand of this Philistine."* The youngest son of Jesse keeps his father's sheep around Bethlehem;
the lamb he once pulled out of a lion's mouth follows him everywhere and talks a lot. The lion is back.

* **The original, studied** (Google Play and App Store pages with their version history to 27.0.0 of
  2026-10-23, xphero.fans's data from the game files, GameWith's chapter charts and system guides,
  reviews). XP Hero is an open-world action RPG on one thumb: a floating joystick walks the hero over a
  top-down map, he strikes by himself at what is near, kit skills fire by themselves; monsters live at
  spawn points on respawn timers; gold, wood and stone go into a **bag with a cargo cap** — full, it
  takes no more, and the hero walks back to the **base** (the bonfire) to empty it and heal; the base
  grows building by building (bonfire, smithy, chest house, training ground, portal, raid camp, ladders
  and stairs built from wood and stone); gold buys **steep ability ladders** (power, HP, cargo, move and
  attack speed, critical chance, HP recovery, double and triple attack); a smithy crafts weapons in six
  categories with evolution (a gacha) and merges three into the next rank; 26 heroes in rarities, a
  team of six, stars 1–6 from pieces, one kit skill each; 20 stages in 3 regions, each with field
  bosses whose **red circles can be dodged** and one stage boss whose fall opens the next stage
  ("progress = bosses; everything else is fuel"); NPC quest chains with "!" and a quest arrow; level-up
  rewards every 5 levels; gift chests every 10 minutes; a **Treasure Goblin** that runs off through a
  portal if not caught; a 250-floor Challenge Tower of 30-second floors; idle auto-hunting; the newest
  update added a Hero Collection (bonuses from owning combinations). Players love the hit sounds, the
  coin showers and the constant level-ups; they hate forced ads after bosses, pay-to-win packs, the grind
  after chapter 1, bosses that reset when you fail, and stats-only combat.
* **Carried over:** the joystick and the auto-strike, spawn camps with respawn timers, the cargo bag and
  the walk back to camp, buildings, the ability ladders (9), weapons by category with evolutions (4
  weapons × 5 tiers), a party with kit skills (6 companions, 3 slots), lands closed by gate bosses with
  dodgeable telegraphs, NPC quest chains with a quest arrow, level-up chests every 5 levels, gift
  bundles, the treasure thief, the tower (the cave of Adullam), idle hunting (a tap). **Adapted:** the
  tap-to-hunt is XP Hero's idle auto-hunt made a control (one-handed play, and the smoke's taps);
  monsters never die (beasts lose heart and run off into the hills; Goliath falls flat on his face);
  the death that drops the cargo is a stumble that wakes David at the camp's fire, bag and all; bosses
  keep their wounds; the smithy's gacha is a fixed price in silver, wood and stone; heroes' pieces are
  friendship from shared XP; the Hero Collection is two **bonds** (the sons of Zeruiah, the mighty men:
  +damage when together); the 20 stages are 6 lands (then round again, ×45). **Dropped:** ads, gems,
  packs, passes, energy, PvP invasion, raids with tickets, runes, traits, soul imprints, blessings.
* **Hands.** A **drag anywhere** is a floating joystick (WASD and the arrows too). A **tap** near David
  (or Space) sends him **hunting** — he walks to the nearest beasts (the quest's kind first, as XP
  Hero's quest button leads) and stands at the sling's reach; a tap farther away walks him there,
  then he hunts. The **sling throws by itself** (every 0.8 s at the nearest beast, then a fighting
  guardian, then the thief); the staff sweeps, the bow pierces, the javelin pierces three; double and
  triple throws come from the ladder. A tap on the **bag** walks him home; a tap on the **great stone's
  dial** (or Space) throws it. In camp a card opens: four tabs (abilities, buildings, forge, party) and
  tiles with their effect in numbers and their price; a tap buys, Space buys the first it can.
* **The lands** (64 × 42 u maps, each with a camp, 7–9 dens, heaps of brushwood and stone, a brook, a
  chest, the people of the story, a lair and a gate): *the pastures of Bethlehem* (jackals, hornets,
  wolves — the lion), *the hills of Judah* (boars, vipers, hyenas — the she-bear), *the Valley of Elah*
  (scorpions, vultures, hyenas; Israel's tents above, the Philistines' below — Goliath), *the fields of
  Gibeah* (aurochs calves, boars, hornets — the great aurochs), *the wilderness of En-Gedi* (vipers,
  caracals, scorpions — the leopard), *the land of Gath* (wolves, hyenas, vultures — a giant of Gath:
  Ishbi-Benob, then Saph, Lahmi and the six-fingered one on later circles, 2 Sam 21:16-20). Beasts
  have habits: chase, lunge (wolf), charge with a telegraphed lane (boar, aurochs), ambush (the viper
  hidden in the grass), hit-and-run (hyena), swoop (vulture), swarm (hornets), leap (caracal).
* **The guardians** sleep in their lairs until their quest comes, then wake when David is near:
  telegraphs drawn true to their hit areas (a lunge lane, a swipe cone, a roar ring, a pounce circle;
  Goliath's spear lane, stomp and taunt — a comic insult in a red bubble that slows David), then a
  **daze** (×2 damage). **Goliath's shield-bearer** walks in front of him and stops stones from the
  front ("Brzdęk!") — walk round to his side; the great stone flies over the shield. Driven off (the
  beasts run off into the hills; Goliath falls flat and the Philistine tents empty, 1 Sam 17:49-52), the
  gate opens, a chest and a story card (1 Sam 17:37, or 17:45 for a giant). Wounds stay across visits
  and sessions; nothing resets.
* **Push — Proca, the sling's whirl.** A dial ring at David's feet, drawn large, its arc running along
  the ring's front: it fills with the band's level (smoothed), the threshold a notch right in front of
  his feet ("próg"), the arc gold past it; the stone whirls round the ring faster with the level and
  its whoosh rises in pitch. Below the threshold the stones fly white ×1 (never less); at it ×2, high
  above it ×4 (in halves), on damage **and** XP, the "×3" drawn beside the ring and in the headline's
  line. A held focus (6 s Mendi / 3 s HALO; golden hits add a little) polishes **the great stone from
  the brook** (1 Sam 17:40): ready, it glows in the sling; a tap or Space (or by itself after 5 s)
  throws it at the strongest target — a guardian loses up to 14 % and reels, a pack scatters — at most
  twice a block. The panel's gauge is the whirl.
* **Rest — Harfa, the harp by the fire** (1 Sam 16:23). David sits down, lights a shepherd's fire and
  plays (notes rise, a plucked pentatonic tune); the party sits round; **every beast dozes**; the
  hands rest too (no walking). Calm heals the party and fills **rested XP** — a blue band ahead of the
  level's bar: the next XP counts double until it is used (WoW's rested XP), so a calm rest pays the
  next push; the night refills the dens. A passed rest ends with the fire's gift (more rested XP).
* **Blind — a moonless night** (every 4th push from the 3rd session): the hills go dark round a small
  light, the ring is an ember, stones fly white; at dawn the block's share above the threshold is paid
  as XP (2 × share × the night's XP) and as a charge of the great stone.
* **The bag and the camp.** Silver (and brushwood and stone from the heaps) flies into the bag; full,
  coins wait on the grass and the lamb nags; the camp empties it into the treasury and heals. The camp
  travels with David: **the bonfire** (the ability ladder; its level caps it at 25 / 60 / all),
  **the forge** (weapons to 10 / 18 / 25), **the storehouse** (the bag ×1.25…×2, chests richer),
  **the well of Bethlehem** (2 Sam 23:15; healing ×1.25…×2), **the sheepfold** (wool: silver a minute
  while playing — the flock as scenery, never the crowd), **the cave of Adullam** (the tower).
* **Abilities** (silver, steep): Siła (damage +8 % a level), Zdrowie (+7 %), Torba (the bag ×1.18),
  Tempo procy, Krok, Celność (critical ×2), Podwójny rzut, Potrójny rzut (after ten doubles), Oddech
  (regeneration). **Weapons:** the sling (Proca pasterska → z koziej sierści → z doliny Ela →
  Beniaminitów, Judg 20:16 → króla), the staff, Jonathan's bow (1 Sam 18:4, a gift), the javelin (up
  to Saul's spear, 1 Sam 26:12, and Benaiah's); levels 1–25, an evolution every five (wood and stone).
* **The party** joins through the quest chains: *Asahel*, swift as a gazelle (2 Sam 2:18: dashes
  through a pack and sweeps the silver into the bag), *Abishai* (a shield: the party takes no harm for
  2.5 s), *Jonathan* (three arrows at the strongest, 1 Sam 20:20), *Abigail* (bread and fig cakes heal,
  1 Sam 25:18), *Benaiah* (the man who went down into a pit with a lion on a snowy day, and came out
  alone: a stunning blow), *Shammah* (who would not give up a field of lentils, 2 Sam 23:11-12: he
  draws the beasts to himself). Slots: 1, 2 from the Valley of Elah, 3 from En-Gedi; stars 1–5 from
  friendship (10 % of the XP they share); each star makes the kit stronger and quicker.
* **Quests.** Each land has a chain from the people of the story (12, 10, 9, 7, 7, 7 quests): hunt N of
  a kind, build, buy, forge, bring brushwood, visit someone, reach a level, the guardian, the gate. The
  visits carry the story and its humour: Jesse sends bread and cheeses to the brothers and Eliab
  grumbles (1 Sam 17:17-18, 28), Saul's armour is far too big — David clanks along at a quarter speed for
  four seconds (17:38-39), five smooth stones from the brook (17:40), Jonathan's gifts, Abigail on her
  donkey, Ittai of Gath — a Philistine friend (ordinary Philistines are never enemies). A pill shows
  the quest and its count; an arrow at the screen's edge (a bobbing marker when in sight) and the
  minimap point to it; a price the treasury lacks points to the heap or the beasts that pay it. Later
  circles: two hunts, the guardian, the gate.
* **Surprises.** A level every few beasts (huge golden numbers and the gains), a chest every fifth
  level; Jesse's bundle every 2.5 min; the land's chest every 90 s; **the golden jackal** who stole the
  cheese runs off zig-zagging and dives into its burrow after 14 s unless the sling catches him (a pile
  of silver and XP).
* **The cave of Adullam** (the tower, after building it; 1 Sam 22:1): floors of 30 s in a torch-lit
  arena with beasts of the lands reached, ×1.13 a floor; a cleared floor pays silver the first time and
  a chest every tenth; the time running out walks David home; the deepest floor is kept. No daily cap.
* **Grace.** Nothing ends a session early and nothing is lost: a stumble wakes David by the camp's
  fire with his bag; the session's end carries the bag home; coins wait; guardians keep their wounds;
  the auto-hunt steps out of red shapes; the hunt and the quest arrow always say where to go.
* **Teaching.** The first session opens with the story card (root verse) and a warm-up; coach marks
  point at the thing when it first matters: drag, tap to hunt (both repeated until done), silver, the
  quest arrow, a level, the bag, the camp's card, the sling's ring and its notch, the great stone, the
  harp, a guardian, the shield-bearer, the thief, the gate, the cave. Later sessions only what is new.
* **Companion.** *Kłębek* (Tuft, Flocke, Ulla): the lamb nearly eaten by the lion — a grudge against
  the lion, terrified of Goliath but trash-talking from behind David, always hungry for the brothers'
  cheese, counts XP like an accountant, bleats mid-sentence when scared ("Beee… to znaczy: uważaj!").
  42 moments × 3–4 lines; Goliath has his own taunts.
* **Pacing** (simulated: `DAWID_PACING=12 npx vitest run test/arcade-dawid.test.ts -t pacing`): a
  typical player reaches level ~12 in the first 5-minute session, drives off the lion in the second,
  Goliath around the sixth to tenth, and the first circle in about twelve; XP to a level 70 × 1.10^L;
  beasts, XP and silver × 1, 2.2, 4.6, 9.5, 19, 38 by land.
* **Headline:** XP (EP in German), the session's own; the line under it: the level and the land, "proca
  ×3" in a golden push, or "N do rekordu". **Closing:** the first session 1 Sam 16:7; a guardian driven
  off 17:37; a giant fallen 17:45; great stones 17:40; a calm harp 16:23; else Psalm 23:1-3.
  `1sa17.34-35` is not used (it ends with the lion killed). Progress is `ver: 1`; the placeholder's
  `{ sessions }` save is read as a fresh one keeping its count.

### 11.7 Dziewiątka — nine heroes against the Din (team battler after Hero Wars: Alliance)

*To be written by the game's builder.*

### 11.8 Nehemiasz — the wall in 52 days (fortress defence after Lordrush)

*To be written by the game's builder.*

### 11.9 Kocia straż — the abbey cats (idle merge shooter after Idle Cat Gunner)

*To be written by the game's builder.*
