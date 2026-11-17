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

**Mobile first (2026-11-12, §12).** Hell Escape is played upright with one thumb; Dolina was laid out
on a desktop (a UI scale of `min(w, h) / 430` floored at 0.84 drew the pack at 11 px, the bubbles at
10.9, the threshold's tag at 8.4) with the pack bottom right, under a right thumb. Now the phone is
the reference (`layout(w, h, insets)`, `u` = the kit's `uiScale`: 1 on a phone, up to 1.3):

* **Upright.** The road runs across the lower middle. The scale comes from the width — 9 u across,
  40 px/u on a 360 px phone (the pilgrim ≈ 56 px, a block 38 px) — so about 1.3 s of road shows
  ahead (the pilgrim a quarter of the way in, the party's room behind him); 5.8 u above the floor keep a
  ledge's top, both jumps and the high gate in sight under the HUD. Under the road a ground band (24 %
  of the canvas, at least 122 px) holds the **pack's row** just under the floor — the sword (its name
  fitted down to 13 px, never losing its tier's numeral), the stones (18 px), the oil — 36 px pills where
  the eye already is and above the thumb, and under them a **thumb pad**. Nothing there is a button:
  the whole field is the control, so the thumb never has to cover the climb.
* **The hands under a finger.** A press anywhere jumps on the press itself; a second press in the air
  is Ćma's flap; holding goes higher. A **swipe down** (20 px, more down than sideways ×1.2; a tap's
  wobble stays under it) stomps. A swipe begins as a press, so a swipe read within 0.25 s on the finger
  whose press made the double jump takes the flap back (`undoAirJump`: the air jump returns, the
  doubles and their mission do not count it) — a stomp never costs the double jump. A soft ring
  answers every press under the finger (even one that only waits as a buffer), a chevron every swipe;
  the haptics stay. Nothing needs a key: on a phone the how-to's hands speak of taps and swipes and its
  `keys` row is left out; on a desktop that row and the first three coach marks (jump, double, stomp)
  name the keys.
* **Cards and toasts at 360 px.** Titles 22 px serif, words 15 px, the verse 14–17 px with its own
  reference line at 13 px (kit/scripture's reference floor is 10); a companion's card puts the
  portrait (the companion scaled to fill it) under the title with the name and the power beside it; a
  level's sparks share its stars' row; toasts are
  16/14 px and at least 44 px tall. **Each is a tap target**: a tap closes it (after half a second, so
  a jump's tap does not close it unread) and still jumps — a card never eats a jump. Cards in play
  (not the opening story, which runs on a quiet road) leave the pilgrim's floor in sight, and all wait
  while the runner's block banner covers the top band (a push's or a rest's first 4.5 s); a coach mark
  the runner holds under its banner keeps Ćma quiet until it has been read (one bubble at a time).
* **A readable world.** Every canvas string is at least 13 px on a phone (`font()` floors at 11):
  blocks' numbers 14 px+ on 19 px plaques, pens, cages and curtains on number plates, the gates'
  plaques, the threshold's tag outlined at 13, the guardian's name 14, the sign for the hands 16; the
  notification shadow's "!" is drawn, not written.
* **Babcia's umbrella** opens over him only for its moments — 1.4 s as Parasol fires, 0.9 s when it
  takes a hit; while armed a small umbrella rides over his shoulder (two for two hits). It no longer
  hides him most of the time.
* **On its side** (601 × 360 with the chart column, the HUD one 68 px row): a 54 px ground band holds
  the pack's row, centred; the scale comes from the height under the row (39.7 px/u instead of 35.4,
  15 u across, the pilgrim at 28 %), so the floor line (306) and the double jump's apex with his head
  stay clear of the HUD row, with about two seconds of road ahead; a notch's insets keep the pack, the
  floats and the cards inside. **A tablet and a desktop** grow the same layout; upright the scene is
  capped at 58 × `u` px/u, so a tablet shows 11 u of valley instead of a giant pilgrim.
* **The frame budget.** No per-frame `shadowBlur`: the card's shadow is an offset shape and the gold
  rim's glow a wide soft stroke.
* **Measured** (scripts/arcade-mobile.mjs, before → after): strings under 11 px — small phone 11 → 0,
  iPhone 4 → 0, large Android 2 → 0, on its side 10 → 0; under 13 px — 13, 13, 14, 13, 2, 2 → 0 on
  all six; targets 0 → the card or toast on screen (finger-sized, inside the insets, no overlaps);
  the game's own frame 1.2–2.4 ms with the CPU slowed 2–4× (60 fps).

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

**Mobile first (2026-11-12, §12).** Mob Control is played upright with one thumb; Chleby now is too.

* **The thumb zone, upright** (`layout.ts`, the reference a 360 × 366 band under the HUD): the tables'
  hunger bars sit right under the HUD (the band is computed from the sprites' size, so their numbers,
  ≥ 13 px, never slip under it); the lane fills the width; the boy stands on the row of twelve baskets of
  crumbs along the bottom, his basket at about 85 % of the canvas; the help button (52 px, its name on a
  ribbon across its foot) is in the bottom-right corner, 20 px from the edge and 16 px above the bottom.
  The band the old simulator switch kept empty is gone: the baskets run from the left edge to the
  button, on a wicker shelf with "Kosze: N" on a plate.
* **Under a finger.** A touch-down fires a handful at once (the recoil answers on the down, not the
  up) and a hold pours. A drag steers the basket by the finger's sideways travel — relative, as in Mob
  Control, a gain of 1–1.8 so the whole lane is about 60 % of the screen's width of thumb travel, with a
  10 px slop — so the thumb rests anywhere low and never covers the basket; a short slider with a knob
  shows under the thumb while it steers. A mouse still aims to the pointer. The help button sinks under
  the finger; tapped before it is full it shakes and says "Pomoc: 40 %". The giant loaf takes a
  generous box round its body (it moves), never by the basket (a tap there pours) nor over the help
  button. Haptics: the help pressed, a building raised, and the moments of v3.
* **The dial.** The champion's ring round the basket keeps its place (the signal in sight); its words
  sit on a plate beside it, on the side with more room — "Wielki kosz 45 %", 13 px.
* **Sheets, not cards.** The level fed (stars, the baskets, the path), the bundles' reveal (at most six
  tiles, three a row, the last "+N"), the village (one finger-sized row per building, 64 px, and a
  48 px "Dalej") and the story cards rise from the bottom as full-width sheets with 13–16 px text (the
  verse ≥ 17 px). On a phone on its side they are side sheets on the left and the lane slides right so
  they never cover it (the v3 reward cards did); a story card there spans the band (it holds the hands
  anyway). A desktop shows the same side sheets, bottom left.
* **On its side** (601 × 292 under a 68 px HUD row): a left column with Mirka and the baskets in two
  rows of six, the lane in the middle (its top under the HUD row — v3 put the tables under the score box),
  the help button bottom right.
* **Text.** `u` is 1 on any phone (kit `uiScale`) and grows to 1.3; `font()` never goes under 11 px;
  bubbles 14 px, banners 28/14, gates' numbers ≥ 13 px with an outline; every string is fitted to its
  room with a floor and an ellipsis. The game's banners sit low on the lane, under the runner's block
  banner, and step aside when a coach mark points there.
* **Words for the hand.** The hints speak of tapping ("stuknij przycisk w rogu"); a keyboard gets the
  keys as shortcuts ("(albo E)", "(albo spacja)") and a keys row on the how-to card, which the runner
  leaves out on a touch screen; the registry's tip no longer names Space.
* **`targets()`**: the help button and the giant loaf in a level, the buildings and "Dalej" on the
  village sheet; a test audits them at all nine `CHECK_SIZES` with the giant anywhere on the lane and one
  to three buildings, and checks the sheets fit, the slide clears them and the font floor.
* **Measured** (`scripts/arcade-mobile.mjs`, six devices, before → after): strings under 11 px 222 / 119 /
  116 / 91 / 0 / 0 → 0 on every device; under 13 px only the gate's "próg" tag, the verse's reference
  and the dozing "z" (small phone 21 → 3, desktop 113 → 1); targets none → the help button, the giant
  loaf, the village rows and "Dalej", all ≥ 44 px, inside the insets and apart; the game's own frame
  0.7 ms on a desktop and 2.3–3.3 ms on the small phone at 4× CPU, 60 fps everywhere. German on the
  small phone and on its side, and HALO on an iPhone, pass too.

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
* **A phone upright, on its side, a tablet:** see "Mobile first" at the end of this section (v2 squeezed
  a desktop layout into the strip between the runner's panel and score).
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

**Mobile first (2026-11-12, §12).** Knight Survivor is played upright with one thumb — a floating
joystick anywhere, the weapons striking by themselves — and so is Jerzy now.

* **The thumb zone, upright** (`layout.ts`, the reference a 360 × 366 band under the HUD). The knight
  stands in the middle of the band and the camera comes closer: ten metres across a phone (`s` = width /
  10; the widest shield still fits). The 62 px the old simulator switch kept empty at the bottom are gone:
  the whole field is the joystick's, and the game's one button, the **Miecz światła's dial**, sits in the
  bottom-right corner — 60 px (a 72 px target), 16 px in from the edge, its name over it. Charging, it is a
  dark plate with the charge running round it; ready, it turns gold, glows, sends rings out and says
  "Stuknij!" (15 px). **Passive things live right under the HUD**: a status band with the hearts (14 px,
  the last one beating when it is all that is left) and Linda's apples, the level (14 px) and its numbers
  (13 px), the level's bar, and a row of 26 px chips for the build (levels at 11 px, ★ when evolved) and
  the treasures (gold coins that overlap when many). While the dragon is around **his bar takes the top
  row** and the status moves down under it (the chips step aside); the marks over his head stay below it.
* **Under a finger.** The joystick's base and knob show where the thumb lands, dim until it steers (a
  10 px dead zone; the base follows a thumb that runs past its rim; a wedge shows the way he walks). A
  touch on the dial lets a ready sword go at once, and a short tap anywhere still does — nothing needs aim,
  the weapons pick their targets. A card is pressed when a finger lands (squashed, a gold rim) and taken
  when it lifts there; sliding off cancels, and the cards ignore a finger for 0.3 s after they come up, so
  a thumb already on its way never picks. Haptics on a pick, a reshuffle and a chest, besides v3's moments.
* **Sheets for the hand.** The level-up is a bottom sheet: the title and Linda's reshuffle (a 44 px pill
  sized to its label) on one row, then three stacked full-width cards, 94 px on the smallest phone and up
  to 118 — the icon in a well on the left, the name (17 px) with its tag, the numbers as large as the card
  allows (13–15 px), the duet or the pair at the bottom. The run's tally has a "Nowy bieg" button, the
  story cards a "Zaczynamy" / "Dalej" one (their text 13–15 px, fitted to the room, the verse 17–19 px so its
  reference stays at the 11 px floor); Linda's bubbles are 14 px, kept under the status band and off the
  dial. **The runner's block banner** covers the upper half for the first 5 s of a block: a level-up offered
  then — and the Postój's free card, which always came with the next block's banner and hid under it —
  waits for it while the world goes on, and the game's own banners drop under the knight meanwhile.
* **On its side** (601 × 360 under a 68 px HUD row, the chart a column on the right): the status top left
  under the HUD row, the dragon's bar top right, the dial bottom right under the right thumb, the cards in
  a row; the field is sized so the widest shield stays clear of the HUD row. **A tablet and a desktop**
  get the same layout grown (`u` up to 1.2): the status and the dragon's bar centred under the HUD, the
  cards in a row — anchored low for a finger, centred for a mouse with the keys under them.
* **Words for the hand.** With a finger the coach marks, the dial and the buttons say "stuknij",
  "przeciągnij", "przycisk w rogu"; a keyboard gets each one's `.keys` variant with the keys as shortcuts
  (WASD, Spacja, 1–3, R) and a keys row on the how-to card, which the runner leaves out on a touch screen.
* **Text and speed.** `font()` never returns under 11 px; what the player reads is fitted down to 13 px and
  then cut, never shrunk further; numbers sit on plates or carry a rim. Glows are baked once per colour into
  128 px sprites (no gradient made per call), the blade's glow lost its per-frame `shadowBlur`, the
  vignette and a hit's red edge are made once per canvas size.
* **`targets()`**: the dial in play; the three cards and the reshuffle in a level-up; the tally's and the
  story card's buttons. The tests audit them at all nine `CHECK_SIZES` (play, the dragon with a bubble, cards
  with and without the reshuffle, the tally, both story cards), check every string drawn (≥ 11 px; under
  13 only a secondary label), the font floor, the press-and-lift of a card, the dial and the joystick, and
  the smoke's input on a desktop and on the smallest phone.
* **Measured** (`scripts/arcade-mobile.mjs`, small / iPhone / large Android / on its side / tablet /
  desktop, before → after): strings under 11 px 80 / 74 / 77 / 27 / 46 / 1 → 0 on all six; under 13 px
  12 / 13 / 14 / 26 / 34 / 53 → 4 / 4 / 3 / 3 / 2 / 2 (only the chip levels, the drowsy "z" and the
  verse's reference); targets none → the dial, the cards, the reshuffle and the story's button, all
  ≥ 44 px, inside the insets, none overlapping; the game's own frame 3.6 → 2.8 ms on the small phone at
  4× CPU slowdown and ~1 ms on the desktop.

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
* **Mobile first** (2026-11-12, §12). XP Hero is played upright with one thumb; Dawid now starts from that
  phone (360 × 500 with a 134 px HUD: a 366 px band) and grows to a phone on its side, a tablet, a desktop.
  * *The thumb zone.* The great stone and the bag are two 60 px round buttons at the bottom right (their hit
    64 × 84 px with the word under them, 16 px from the edges, 12 px apart). The stone's ring fills with its
    charge ("43%"); polished, it says "Rzuć!" and glows only while something in sight can be hit ("Gotowy"
    otherwise, e.g. by the harp); a tap that cannot throw shakes it and says why ("Kamień: 43%", "Brak celu w
    zasięgu") instead of falling through to the field. The bag's ring is its load ("23/60"); full, it glows and
    says "Do obozu"; by the harp it shakes. The party, health ("125 / 128" inside its bar), the level's badge
    and bar ("Poz. 3", "69 / 85" inside, the rested band and "×2" ahead of it) and the treasury sit at the
    bottom left — stacked on a narrow phone, one row on a wide screen — at 13 px with an outline. The old
    62 px reserve for the simulator's switch is gone: `insets()` says what covers the edges.
  * *The top band* is passive: the quest pill (13.5 px, two lines when the words need them) and an 84 px
    minimap (112 px on wider screens). A tap on the pill sends David to the quest by himself — XP Hero's quest
    button: to the sling's reach of the den or the guardian it wants (then he hunts), to the person, the heap,
    the gate, home for a purchase. A shortcut, never needed: the arrow and the hunt still lead.
  * *Under a finger.* A finger on the field shows the floating joystick at once: a dark base with a light rim
    and four marks where it went down, the knob under it, a gold wedge on the rim toward the walk; it fades
    when the finger lifts. A tap leaves a ring where David goes (round him when he hunts) and his goal stays
    marked on the ground. The buttons, the tabs and the tiles show pressed on touch-down and act on lift; a
    thumb that slides off a button (10 px) steers instead, so a drag that starts on the bag is still a drag.
    Haptics on a button, a purchase (a double pulse when refused), the great stone, a companion, a quest.
  * *The camp's sheet.* Upright and on a tablet: a sheet from the bottom over the bottom band, with the
    treasury (silver, brushwood, stone) and "Na łowy ›" (back to the hunt in one tap) on its top edge, four
    48 px tabs ("Zdolności", "Budowle", "Kuźnia", "Drużyna": short enough for 13.5 px at 360 px; "Talente" in
    German), two columns of 60 px tiles on a phone (three on a tablet) at 13–14 px: the name (and level), what
    the next step gives, the price in icons or why not. The tiles scroll under a drag (a fling, a thin bar, a
    fade at the edge); a tap on a tile cut by the window's edge scrolls it into view rather than buying; a
    tile that cannot be bought shakes. It leaves at least 82 px of field above it, where David stands. On its
    side and on a desktop the sheet comes from the right (two columns, three on a desktop, at most 60 % of the
    width) and David stands in the middle of the field left of it.
  * *Sizes.* `u = uiScale(w, h)`: 1 on any phone, up to 1.3. `font()` never returns under 11 px; whatever is
    read to play is at least 13 px: story cards 15.5 px (14.5 on a short screen, the card wider) with the
    verse first (13.5–18 px, its reference 13), bubbles 14.5 px, floaters 14–22 px, the ring's "próg" 13 px.
    The map shows about 11.5 u across a phone (the sling's 5.6 u reach on either side) and zooms in on a
    tablet (up to 66 px a u) rather than showing the world small. Bubbles stay in the field, above the buttons
    and the sheet.
  * *Words for the hand.* With a finger the coach marks, the story cards and the how-to say "stuknij",
    "przeciągnij"; with a mouse their `.keys` variants say "kliknij", "WASD i strzałki", "Spacja", and the
    how-to card has a `keys` row of its own, which a phone's card leaves out (mendi.ts).
  * *Performance.* `glow()` draws a sprite baked once per colour instead of a radial gradient per glow per
    frame; no shadow blur, no filters. The game's own frame stays about 1 ms on a desktop.
  * *Measured* (scripts/arcade-mobile.mjs, six devices, before → after): strings under 11 px 137–201 → 0,
    under 13 px 4–21 → 0 (German and HALO too); targets 0 → the two buttons, the quest pill, the sheet's
    hunt, tabs and tiles, the story card, all ≥ 44 px, inside the insets, apart; the game's frame 1.12 →
    1.04 ms on a desktop, 4.27 → 3.94 ms on the small phone at 4× slowdown; the camp's sheet on a phone on
    its side now leaves the field its left 45 %.

### 11.7 Dziewiątka — nine heroes against the Din (team battler after Hero Wars: Alliance)

**The original, studied (2026-11).** Hero Wars: Alliance turned ten this month (Dominion Day, a birthday
cake grown by guilds, a Seer's Game without bad-luck cards, Primordial skins). Under the events it is one
loop: five heroes, placed by attack range, fight by themselves on a side-view field; **every basic attack
or skill gives +10 % energy, every 1 % of health lost +1 %, a finishing blow +30 %**; a full bar (1000)
makes the portrait glow, and **a tap fires the ultimate** while the battle freezes for the cast (auto mode
fires it alone). The skill is timing: break a cast with a stun before it starts, hold a heal for the dip,
chain a buff into a carry (a hero's artifact weapon buffs the whole team for 9 s when it fires). Around it:
a campaign of chapters and missions with **three stars by losses**, heroes grown by levels, **colour ranks
from six pieces of gear** (each rank opens the next skill), **stars from soul stones**, artifacts, glyphs,
skins, pets, talismans and relics; the **Tower** (floors, health and energy carried over, three random
buffs bought with skulls at altars, chests every third floor); arenas, guild wars, Legends Draft, the 2025
Eternal Frontier (endless waves after the campaign) and the 2026 Realm. Players love the collection, the
small daily increments, the team-building puzzle ("chemistry, not star power") and the ultimates' drama;
they hate pay-to-win, VIP gates, energy limits, FOMO and the ads' pin puzzles that the game barely has.

**What carries over.** The side-view auto battle and Hero Wars' own energy numbers; the tap on a glowing
portrait, the cast's freeze and interrupts; roles and lines (tank, guardian, fencer, support, control,
bard, archer, healer); factions as three families with two/three-of-a-kind bonuses; counters; missions of
three waves with three stars; levels, **six-piece colour ranks** (white → red, the green and blue skills
open on the way) and **stars from notes**; the Tower's loop (its altar becomes our well, its floors the
Bell Tower after the campaign, a chest every third floor). **Adapted:** auto becomes a *semi-auto* — a ready
ultimate goes by itself after its role's wait (damage 2.5 s, healers when someone is low, control when a
shadow winds up, all within 7 s), so a tap is always sooner and timed, and a passive player still plays.
**Dropped:** arenas, guilds, titans, pets, artifacts, glyphs, skins, talismans, relics, battle timers,
stamina, VIP, gems and summons; the pin puzzle (a planning puzzle would fight the calm of a rest block).

**The town and the story.** Zacisze (Stillwater / Stillwinkel / Stillvik) is flooded by Zgiełk, the Din:
its bell fell silent and noise-shadows fill the streets. Klara, the bell-ringer's granddaughter, calls nine
friends with unusual names. Six districts are the campaign's chapters (the Market, the Mill, the School, the
Bridge, the Gardens, the Square), five missions each, a boss of the Din in every fifth; after the Square the
Bell Tower opens: endless floors, a boss every fifth, a chest every third, the best floor kept.

| Hero (Gal 5:22-23) | Family | Role, line | Ultimate | Green / blue skill |
|---|---|---|---|---|
| Miłość (Love) | Heart | support, mid | **The Bond**: a red ribbon over the five for 6 s — blows are shared by all, +25 % damage, a heal | heals the weakest on each hit / a shield |
| Radość (Joy) | Heart | bard, mid | **The Song**: +300 energy to the other four, +30 % attack speed | +8 % speed aura / wakes the yawned |
| Pokój (Peace) | Heart | healer, back | **Calm after the storm**: 30 % health to all, silences, slows and stuns washed away, the Green-eyes' copies gone | every third hit heals / a heal |
| Cierpliwość (Patience) | Hands | tank, front | **The Patient Wall**: every shadow must strike her, −60 % for 5 s, then she answers with 40 % of what she took | less damage when low / heals herself |
| Uprzejmość (Kindness) | Hands | control, mid | **A cup of tea**: the two (three) biggest shadows sit down for 4 s; wind-ups broken, Hotheads deflated | calms a swell / a biscuit heal |
| Dobroć (Goodness) | Hands | archer, back | **Overcome with good**: a beam along the whole street, through any mirror | +40 % on mirrors / a volley |
| Wierność (Faithfulness) | Roots | guardian, front | **Coming back for you**: the last to fall gets up with half health; else a shield and a guard | takes one killing blow per wave / blinds |
| Łagodność (Gentleness) | Roots | control, back | **Lullaby**: dandelion seeds put every shadow to sleep for 3 s; every wind-up broken | weakens what she hits / soothes a swell |
| Opanowanie (Self-control) | Roots | fencer, front | **One stroke**: a dash to the shadow winding up (or the boss): × 7 (× 14 on a wind-up), the mirror broken | a calm crit / a parry |

A new player starts with Patience, Love, Joy, Peace and Goodness; Kindness joins just before the Market's boss
(so the first wind-up can be broken), Gentleness after the Market, Faithfulness after the Mill, Self-control after
the School (each with a story card, taking a flexible place of the five until the player chooses the five in the
lobby). Families: two of a family in the
five give a bonus, three a bigger one (Heart: their ultimates give the five +80/+160 energy; Hands: +10/20 %
damage; Roots: −10/20 % damage taken).

**The Din** (ink and static with comic faces; hushed, they close their eyes, smile and dissolve into quiet —
never hurt): Rozproszki (Scatterflies) fly to the fullest bar and nibble energy; Kłótniaki (Squabblers) split
into two little ones when hit hard; Gniewosze (Hotheads) swell with every hit and burst at five (a wind-up);
Pyszałki (Show-offs) hide behind a mirror; Leniwce (Sluggards) soak and yawn the team slower; Zazdrośniki
(Green-eyes) copy the five's buffs; Pośpiechy (Rushers) run for the back line; Plotki (Gossips) whisper a hero
silent. The bosses: the Crier (a shout that pushes back, calls Scatterflies), the Rattle (a roll along the
street), the Hubbub (a silence over all, calls Squabblers), the Honker (stuns the front, calls Rushers), the
Great Show-off (a fan of mirrors, "look at me!") and the Din itself (three thirds: shout, roll, hubbub). Every
wind-up shows a red bar: Kindness, Gentleness or Self-control breaks it ("Przerwane!", the shadow dazed ×1.5).

**The band is the energy (the core).**

* **Push (focus):** in a sighted push block past its lead-in (5 s Mendi, 2 s HALO) every energy gain is ×
  (1 + 2·level): ×1 without signal, **×2 at the threshold, ×3 well above**. The bars turn gold above the
  threshold, and a big dial by the portraits shows the multiplier with the threshold notched at ×2 (the panel's
  gauge is the same quantity, `meter()` = (×−1)/2). Focused play fires about twice as many ultimates. The push
  block is the peak: as the lead-in ends the Din surges (two more shadows), and while the dial is gold one more
  forms every 2.2 s, between waves too (at most nine a block) — more to hush with more ultimates.
* **Harmony** (the power fantasy): a held focus (hold ≥ 5 s Mendi / 3 s HALO) fills the bell (full in about
  12 s). Rung (a tap on the bell, the street or Space; by itself after 6 s), the world holds, the fallen get
  up, **all five ultimates go at once** with their notes rising into a chord, the town's bell swings and a wave
  of quiet sweeps the street. In practice once per good push block.
* **Rest (calm) = the well:** the Din draws back and dozes, the five sit around the town well; after a lead-in
  calm heals (2 %/s always, up to 6.5 %/s calm) and the fallen stand; the well's water is the gauge — ripples
  that shrink with calm, the threshold a dotted ring, a silver shimmer above it. The hands sew gear on (a tap on
  a portrait, or the street for the one closest to a rank). The block's end offers **one of three boons**
  (golden after a calm rest): a song (+400 energy), warm soup (+20 % health), a woollen scarf (−12 % damage),
  a snare drum (+12 % speed), gingerbread (+12 % damage), the tower key (+30 % Harmony), Auntie's first-aid kit
  (the next to fall gets up), full pockets (+2 pieces). The last boon of a session waits for the next one.
* **Blind push = a fog of noise:** ×1 in sight, the dial fogged, the newest houses veiled; the block's share
  above the threshold pays into Harmony at its end.
* **History in the world:** the row of houses behind the street — one house per bar of the last 44 s, its
  windows lit by the level, gold above the threshold, cool blue in a calm rest, a dotted sill without signal.

**Missions, stars and grace.** Three waves per mission (a boss with two of its kind in the fifth); shadows form
out of the noise on the street; three stars if nobody fell, two with one, one with more. A wave cleared gives
XP to the five (levels: +7 % per level) and now and then a piece of gear and a note; a mission gives pieces
(+1 for three stars, +2 for a boss) and notes of its featured hero (stars: +12 % each). Six pieces make the
next colour (+15 %). **Grace:** a fallen hero sits out of breath until a revive, the chord or the well; a wipe
is a stumble (a card, Klara's handbell, everyone up at half health, the wave loses heart, the stars drop to
one, the score stays); the Din is shy against a team behind its pace (down to 62 %); a wave fought longer than
35 s tires and fades; nothing waits on the band. Balance (simulated over 14 sessions): flat play wins 2–5
missions per 5 min with nobody lost on ordinary waves, and loses a star now and then at a boss; focused play
hushes 35–160 % more, fires about twice the ultimates and keeps its three stars; the campaign takes about
10–14 five-minute sessions.

**Companion, story, instructions.** Klara talks in short bubbles (25 moments × 3–4 lines, 4 languages): her
deaf grandpa who thinks the Din is an orchestra, the notebook where she writes every hushed shadow "in her
neatest hand", Patience who starts sitting down mid-battle, Joy who sings out of tune, Kindness who serves tea
to everybody but her, and her wish to ring the big bell herself. Story cards: the opening (with Galatians
5:22-23), each district quiet, each newcomer, the Bell Tower; the summary's first line closes the session (the
bell rang a full chord / a district quiet / Klara's notebook count). How to play: tap a glowing portrait; the
bell; the well. The first session teaches with coach marks, one at a time when it first matters: the first
glowing portrait, the street tap, the dial, the bell, the well, the boons, the first wind-up, and each kind of
shadow (later sessions: only new things). Headline: hushed (uciszony/uciszone/uciszonych; hushed; besänftigt;
tystad/tystade); the sub-line names the mission or the record within reach.

**Closing passages** (in turn): the first session Gal 5:22-23; a chord Col 3:14 (love, the bond of perfect
unity); a boss or a district hushed Rom 12:21; wind-ups broken Prov 16:32; the fallen carried back 1 Cor 13:7;
calm rests Jas 1:19 and Eccl 3:7.

**Reverence (§11.5).** The nine are characters carrying the names of the fruit of the Spirit, an allegory of
virtues against vices; nothing is "power of the Spirit"; Faithfulness is *wierność* (Treue, trofasthet), never
"faith". The Din's shadows are noise that dissolves into quiet; nothing dies, no blood. Boons are boons, never
"blessings". The bell of Zacisze, the Din and the nine are this game's symbols.

**Files.** `rules.ts` (numbers), `content.ts` (heroes, shadows, districts, missions, boons, lines),
`battle.ts` (the combat), `sim.ts` (the session), `meta.ts` (progress v1, growth), `talk.ts`, `render.ts`,
`hud.ts`, `paint.ts`, `layout.ts`, `intro.ts`, `preview.ts`, `panel.ts` (the lobby card: map, the five,
families), `audio.ts`, `i18n.ts`, `index.ts`; tests in `test/arcade-dziewiatka.test.ts`.

**Mobile first (§12, 2026-11-12).** Hero Wars is held on its side; Dziewiątka is laid out for a phone held
upright in one hand first, on its side second, and grows from there (`layout.ts`: three shapes of one view,
sized for a 360 px phone at `u` = 1, `uiScale` up to 1.3 on a tablet or a desktop).

* **Upright: the thumb zone.** Everything pressed again and again sits in the bottom 45 %: the five portraits
  across the width as big cards (61 × 86 px on a 360 px phone, 67 × 95 on an iPhone, 6 px apart, 16 px clear of
  the screen's side edges), and over them one row with the energy dial (left) and the bell (right, a 140 px wide
  plate), 50–61 px tall. The 54 px the simulator's switch kept empty at the bottom is gone. The street takes the
  whole height above the row, from the HUD down (208 px on the smallest phone, 470 on an installed iPhone): the
  figures are drawn larger than their spacing (the band's height decides, up to ×1.8) and the rows twice as deep,
  so the five stand staggered instead of in a clump; the mission's pill and the boss's bar sit right under the HUD.
* **On its side** (601 × 360 beside the chart's column): one strip along the bottom — the dial (the arc, ×1,0 and
  "Energia"), the five (71 × 73) and the bell — and the street across the width above it, as close as before. A
  tablet upright is the phone grown (cards 149 × 135 with names, figures twice the old size instead of a tiny
  street under an empty sky); a desktop is the strip grown and centred.
* **The portraits.** The face in its rank's ring, the stars drawn on its rim (shapes, not 8 px glyphs), health and
  energy bars 6.5–9 px. A full bar lifts the card and bounces it, with a baked gold glow, a 3.5 px gold border, a
  "Stuknij!" tag across the chin and the semi-auto's ring closing around the face (reduced motion: the glow
  without the bounce). Names only on cards ≥ 84 px wide; on a phone the face, its colour and the stars say who.
* **Under a finger.** A portrait, the bell or a boon card squashes the moment a finger lands; a portrait fires on
  touch-down (an interrupt is a matter of timing). A tap in the gap between two portraits means the nearer one,
  never the street; a tap on the street fires the next ready ultimate and leaves a ring where it landed; a bell
  that is not full shakes its head. The boons rise as a bottom sheet of three stacked full-width cards (76–118 px,
  names 16 px, texts 14 px) and a card is taken when the finger lifts on it, only once the sheet has been up
  0.45 s — a thumb still sewing gear at the well is not a choice. On its side and on a desktop the three stand in a
  row. Haptics: 18 ms a fired ultimate, 8 ms a piece sewn, 12 ms a boon, patterns for the chord and a rank-up.
* **Words for the hand.** On a touch screen the how-to, the coach marks and the sheet's hint speak of taps only
  ("Stuknięcie w pole odpala najbliższy gotowy cios", "Stuknij kartę, którą wybierasz"); Space, 1–5 and B are a
  `keys` row of their own, which the runner leaves out there. Klara holds her line while a coach mark is up, so
  two bubbles never stack over the street.
* **Text.** `font()` never returns under 11 px. Story cards 16 px (the verse 15–17 px in the game's own layout,
  its reference 13), Klara's bubble 14, the boons 14–16, the pill 13, labels on the dial and the bell 13, the
  multiplier 23–35; the dial's "próg" tag is the one 12 px string. The flying numbers and cries had been drawn
  with an invalid font ("17px 800 Manrope…", which a canvas ignores, so they fell to the last font set: 10 px);
  they are drawn bold with an ink outline now, 13 px at least. A summary keeps five highlights (one chord is the
  closing line's already), so a phone shows the verse and the buttons without a long scroll.
* **Performance.** Glows are baked once per colour into 128 px sprites (the lit windows alone asked for up to 64
  radial gradients a frame); the sky with its sun and far roofs and the cobbled street (~300 cobbles) are painted
  once per size and district into two layers and copied each frame.
* **Measured** (`scripts/arcade-mobile.mjs`, six devices, before → after): strings under 11 px 36 / 25 / 24 / 23 /
  18 / 21 → 0 on every device (the small phone, the iPhone, the large phone, on its side, the tablet, the desktop);
  under 13 px 9 / 17 / 10 / 30 / 15 / 5 → 1 (the tag); targets 0 → 7 (the five, the bell, the story card; the
  boons when they rise), all ≥ 44 px, inside the insets, apart; the game's own frame time 3.86 → 3.55 ms at a 4×
  slower CPU on the small phone, 2.16 → 1.70 at 2× on its side, 1.37 → 0.83 on the desktop; the empty band under the
  strip 54 → 10 px; on the smallest phone the street 184 → 208 px of its 366 px band, the figures 30 → 35 px per u
  and the rows 12 → 28 px deep.

### 11.8 Nehemiasz — the wall in 52 days (fortress defence after Lordrush)

*Nehemiah 2:18 — "“Let us start rebuilding,” they replied, and they set their hands to this good
work."* The walls of Jerusalem lie in rubble; Nehemiah, the king's cupbearer, walks the city with the
plans. A build-and-defend game after Lordrush and the genre its ads come from: by day you build, by
night you keep the watch, gate by gate through Nehemiah 3.

* **The original, studied** (status file of the build): Lordrush (Century Games, July 2026) is a
  reskin of Kingshot. Its ads and first days are a defence game in the spirit of Thronefall — a lord
  moves through ruins, stands on build spots, resources fly in and a wall or tower pops up; at night
  columns march along visible roads, walls slow them so the towers have time to strike, heroes are
  sent where it matters. The full game is Kingshot's town: a Town Center that caps every building,
  survivors as workers, hunters and cooks, houses, health from food and sleep, happiness and unrest,
  Court decrees with trade-offs, research, a world map. Players love the look and the gentle learning
  curve and hate that the promised tower defence thins out, the pay-to-win and the timers. Thronefall
  adds the rules worth copying: days without a clock, buildings that pay in the morning only if they
  stood, the next night's enemies shown at their spawn points, branching tower upgrades, the king
  fighting in person. **Carried over:** walk, stand on a marker, build; walls that slow and towers that
  strike; waves along roads with a preview; tower choices; posts of guards; officers who join; jobs and
  houses; food and strength; decrees; a Town-Center cap; days as the campaign. **Dropped:** timers,
  speed-ups, gems, gacha heroes, alliances, PvP, the world map, idle income, losing the castle.
* **View and verb.** The stretch of wall across the screen, the hills and three roads above it, the
  city below, seen from the city at a slant (the wall shows its inner face; raiders at its outer foot
  stand just above its top). Drag anywhere = a floating joystick (WASD/arrows); standing still on a
  marker builds it in 0.75 s while stones and beams fly in from the yard (walking off cancels and pays
  back). A tap on a marker sends Nehemiah to build it; **a tap anywhere else or Space builds what the
  guide chip suggests** ("Następne: …", Kingshot's recommended task) — the most useful build the stores
  can pay: keep the builders busy on the lowest stretch, bread before hunger, the gate's doors, a tower
  and a fire by tonight's busiest road. A tap never cancels a build in progress. At night a tap or
  Space blows a ready horn, otherwise sends Nehemiah where it is hottest (after raiders inside the city,
  else onto the wall walk above the most pressed stretch).
* **The stretch** (reset for each gate): six sections and the gate in tiers — *pół muru* (Neh 4:6),
  *pełny mur*, *mur z blankami*; the gate's *wrota i belki*, *zasuwy i rygle* (Neh 3:3), *wieża bramna*.
  Building a tier orders it; the builders lay it course by course (40/60/80 cubits). A half wall is
  climbed over, a full wall must be pried open or scaled with ladders, battlements throw ladders off
  where guards stand. Four watchtowers (by the side roads and on either side of the gate; at level 2 a
  choice: *daleki zasięg* or *szybkie proce*), five watch fires (the gate's lit from the start), three
  guard posts (the gatekeepers' by the gate from the start, Neh 7:1). **The city** (kept from gate to
  gate): houses (room), the bakery (the Tower of the Ovens), the granary, the well (strength and mortar),
  the stone yard and the governor's house, which caps every other building one level above it.
* **People and stores.** Stone (the wall), beams from the king's forest (Neh 2:8; the scarce one: gates,
  towers, fires) and bread. Jobs come with buildings — quarrymen, bakers, a water carrier, guards and
  slingers — and **everyone else builds the wall** (at least a third always do). At dawn timber arrives
  and volunteers come from a town of Judah (Neh 3: Jericho, Tekoa, Gibeon, Mizpah…) when there is room
  and bread; at dusk everyone eats; hunger, fear of plunder and hard nights lower *siły* (strength,
  Neh 4:10), bread, the well, held nights and the Sabbath restore it; work goes with strength. Builders
  with nothing ordered dress stones, laid at once when the next tier is ordered — calm is never wasted.
* **Decrees** (Kingshot's Court, from the book itself), a choice of two at the dawn of every third day,
  each with its numbers: cancel the debts (Neh 5), gates shut till the sun is hot (7:3), half build and
  half hold spears (4:16), everyone sleeps inside the city (4:22), the governor's table (5:17), the
  Sabbath (13:19), a letter to Asaph (2:8), clear the rubble (4:10).
* **Rest — the working day:** a day is a rest block. Past its lead-in `calm` sets the builders' rhythm
  ×1 … ×2.2 (the trowels' tapping speeds up): courses laid, breaches mended (mending comes first and is
  not counted), stone and bread made. A day judged calm pays +4 stone and bread. Never below the base.
* **Push — the night watch:** raiders of Sanballat (the road from Samaria), Geshem (over the hill) and
  Tobiah (from Ammon) come in three waves: *zbój* (pries stones), *procarz* (stays in the dark and
  slings at the fires, dimming them), *drabiniarze* (a ladder for a full wall), *taran* (a ram for the
  gate), and on a gate's last night *herszt* on a donkey (the great assault: near him the others take
  fewer blows; when he runs, they all run). **The watch fires are the band, drawn large:** in a sighted
  night past its lead-in each fire's light reaches base + `level` × extra (1.1 → 4.3 u); its threshold
  is a dotted ring on the ground, its edge turns gold above it. Towers and guards strike **only what
  stands in the light** (or at the wall's foot, or by Tirza's lamp); in the dark only the whites of the
  raiders' eyes glint, and they slip to the wall. In strong light raiders hesitate. Nehemiah's presence
  disheartens raiders near him and speeds the defenders (Neh 4:14); Hanani and Hananiah join from the
  3rd and 5th gate. Struck, raiders lose heart and run (Neh 4:15), dropping what they carried; nobody
  dies. **A held focus charges the ram's horn** (the shofar); a tap blows it where Nehemiah stands —
  every raider near him runs, every tower looses a volley, the guards rally to him (Neh 4:18-20, told
  in a story card). Mid-night Sanballat's messenger brings **the invitation to Ono** (Neh 6:2-4): a
  focus held for 5 s answers "a great work — I cannot come down" (+25 % horn; Neh 6:3 on the card).
* **Blind — a moonless night:** the fires stay at their base, the ridge is misted; at dawn the moon
  rises with the night's share above the threshold, which carries into the next night's horn.
* **The signal in sight.** The fires' rings (live), and the history as **the ridge of the far hills**:
  the last 40 s as the skyline, the threshold a dashed snow line, gold where above, a cool tint behind
  the days, mist over a moonless night, the band's delay bracketed at "now". The runner's panel names
  the gauge *Ogniska straży* (night) and *Rytm pracy* (day).
* **The calendar and the meta.** Every day block is a day; 52 days through the ten gates of Neh 3
  (5–6 days each), Sheep Gate to Inspection Gate, the Dung Gate with its jokes. A gate's stars: the gate
  and half a wall everywhere · a full wall everywhere · no breach at any dawn and nothing carried off.
  Stars buy **the king's letters** (permanent: more timber, faster builders, a quicker horn, more bread,
  more guards, an escort's towers). **The chronicle of builders** collects the towns and each gate's
  builders (18). After day 52 the wall is finished (Neh 6:15) and dedicated (two choirs, Neh 12),
  and year 2 begins, harder. The session opens at dawn (the warm-up is the first morning) and ends on a
  night; the next dawn is the finale.
* **Grace.** Nothing ends early; a breach is mended by day; at most a quarter of a store can be carried
  off in a night, and what is struck down is gathered back; without the signal everything plays at its
  base.
* **Tirza and the story.** *Tirza*, one of Shallum's daughters (Neh 3:12), a builder with a trowel and
  a sharp tongue, follows Nehemiah (a lamp at night) and talks in short bubbles (22 moments × 3–4
  lines): her trowel, her faster sister, Dad who rules half a district, the nobles of Tekoa who "would
  not stoop" (Neh 3:5), the Dung Gate. Sanballat and Tobiah sneer from the hill as comic villains;
  Tobiah's fox walks the wall once it stands full height (Neh 4:3) and the wall does not budge. Story
  cards: the opening (Neh 2:18), each gate's card from Neh 3, the horn, Ono (Neh 6:3), the finished wall
  (Neh 6:15), the dedication (Neh 8:10), year 2 (Isa 58:12); Tirza's closing line in the summary.
* **First session.** A warm-up morning with coach marks one at a time, each only in its own time of
  day: drag to walk, tap to build, the builders, the night and its light, the threshold ring, the horn,
  the working day, a decree, a breach, bread; the first night is gentle (3 raiders).
* **Headline.** Cubits of wall raised (`łokci / cubits / Ellen / alnar`), new courses only, live; the
  line under it: "Dzień 7 z 52 · Brama Rybna" or the record within reach. **Closing:** the wall finished
  (Neh 6:15, 8:10), a gate built (Neh 2:20), Ono turned down or a long held focus (Neh 6:3), breaches
  mended (Isa 58:12), a calm working day (Neh 3:12, Tirza's family); else Neh 2:20.
* **Smoke contract.** The centre tap and Space build the guide's suggestion by day (the builders lay
  from second 1 on the two sections ordered at a stretch's start) and blow the horn or chase raiders by
  night; cubits rise within 22 s on either band, first session or later.
* **Saves.** Progress `ver: 1`; the placeholder's `{ sessions }` keeps its count and starts the
  campaign; a v1 save with wrong types is repaired and clamped.

**Mobile first (§12, round 6).** Before: a UI scale of 0.72 on every phone (the stores' numbers 9 px, cost
cards 9 px, "próg" 7 px, bubble names 8 px), a 45 px empty band under the bar (the old simulator reserve), the
guide's chip no button, the horn a small dial at the edge, a phone on its side showing the city in a 600 × 230
strip, and the fire, wall and post markers at x 3.9 and 14.1 stacked within 1.5 u, where no finger could pick one.

* **A phone upright** (the reference: the 360 × 366 band of a small Android): the world zooms to at least 42 px
  per u (≈ 8.6 u across) and the camera follows Nehemiah — by day it keeps the wall's badges in sight while he
  works in the city; by night, and at dusk while tonight's preview shows, it looks up to the hills, the roads and
  the ridge of the band's history. The bottom is the thumb's: a panel with the stores (five numbers at 14 px)
  over one big button — by day **"Następne"** (the guide's build and its cost; a tap builds it), by night **"Na
  mur!"** (Nehemiah runs where it is hottest; "Za zbójem!" when a raider is inside, with the night's tally)
  beside **the ram's horn**, a 64 px button: its charge as a ring and a percent, then gold, breathing, "Dmij!",
  with a double tick of the phone when it fills. The controls end 10 px above the screen's foot (the home
  indicator's inset kept); nothing is reserved under them.
* **Build badges.** Every site with a build carries a badge — what it builds (bricks, an arch, a tower, a flame,
  a spear, a house, a loaf, a sack, a well, stacked stones, the governor's columns), its next level as pips,
  cream where the stores can pay, dark where not, gold and bobbing under a chevron for the guide's pick. Their
  tap boxes stand in rows that never overlap at 42 px per u or more: the fires and towers above the wall line
  (down to the spot where Nehemiah stands), the wall's sections and the gate on the scaffold strip below it (a
  section's whole width), then the guard posts and the city on their plots — the posts moved back from the
  scaffold for it (y 6.1 → 7.2; their guards still stand on the wall at night). Only a badge wholly inside the
  band and 16 px from the edges takes a tap. Standing on a spot still builds it, and a tap on the open field
  still builds the guide's suggestion (the smoke's centre tap on a desktop lands on the open city: a test).
* **Under a finger.** The buttons, the badges and the cards look pressed the moment a finger lands and act when
  it lifts on them (a finger that slides off walks instead); the horn blows at the touch, and a press before it
  is ready shakes it; a ripple answers a tap on the field; the floating joystick shows its base under the thumb
  and its knob. A pressed badge raises its cost card (one at a time: the pressed badge, else the site Nehemiah
  stands on, else the guide's pick on wider screens — those two only where they cover no other badge).
  Haptics: a tick when a build is paid, a double tick when the stores fall short or the horn fills, and the old
  patterns for a build, a tier, the horn, a breach and a finished gate.
* **Cards.** A story card fits a 360 px phone whole: its text at 16 px stepping down to 13, the passage uncut at
  17–13 px with its reference drawn at 13 px (the kit's reference would be 10 px), the kicker giving way only on
  the tightest screen — checked in four languages at every size. The choice cards (a decree, a tower's way) stack
  full width on a phone, the name at 18 px and the effect at 15 px; side by side on its side and wider.
* **Tirza's bubbles** (14 px on a phone) take the place where they cover the fewest badges; a badge under a
  bubble (or under tonight's chips) waits, and a tap on the bubble hushes it.
* **The night at phone size.** Each fire's light edge is a crisp stroke over a soft wide one (no blur), gold
  above the threshold; the dotted threshold ring is at least 2 px; the ring between the two glows gold above the
  threshold and reads dark below it; "próg" stands on a plate on the ring nearest the middle. Tonight's raiders
  line up as chips under the HUD, with an arrow toward each road whose head is off the screen.
* **Nehemiah's officers** got their own figures: Hanani in a teal robe with the family's gold sash, his blue
  cloak streaming as he runs to the pressed stretch; Hananiah, the citadel's commander, in steel and red with a
  crested bronze helmet and a round shield at the gate — each with a gold ring at his feet.
* **On its side** (601 × 360 beside the chart's column): one row along the bottom — the stores on the left, the
  button, the horn in the right thumb's corner — and the camera pans both ways at 42 px per u (14 u across). A
  tablet is the phone grown (u 1.3, 10 u across); a desktop is the row grown and centred under the whole stretch.
* **Words for the hand.** With a finger the how-to says drag and tap; the keys are a row of their own that a
  phone leaves out (WASD / arrows, Space, 1–2); the coach marks for walking, the guide and the horn come in a
  touch and a keys version, and the story card says "kliknij albo Spacja" only on a desktop.
* **Measured** (`scripts/arcade-mobile.mjs`, before → after): strings under 11 px small phone 63 → 0, iPhone
  42 → 0, large Android 41 → 0, on its side 67 → 0, tablet 7 → 0, desktop 0 → 0 (under 13 px: 14/33/30/12/41/7
  → 0 on every device; German and the HALO the same); targets 0 → 37–286 seen (badges, the guide's button, "Na
  mur!", the horn, the cards, the bubble), all ≥ 44 px, inside the insets, none overlapping; the game's own frame
  0.98 ms on a desktop (3.6 ms on the small phone at 4× CPU slowdown); the desktop smoke's input raises 60 cubits
  in 60 s. Layout tests run every `CHECK_SIZES` entry with Nehemiah at 520 places (day and dusk), the night's
  buttons, the stores' strip, every story card and every decree pair in four languages.

### 11.9 Kocia straż — the abbey cats (idle merge shooter after Idle Cat Gunner)

*Song of Songs 2:15 — "Catch for us the foxes—the little foxes that ruin the vineyards—for our
vineyards are in bloom."* An old abbey on a hill; Brother Anselm, its gardener and master of soup, has
a problem: little foxes spoil the vines, mice nibble the grain, sparrows go for the grapes. Luckily the
abbey has cats. They sit on cushions along the old wall and keep watch with their toys.

* **The original, studied** (2026-11: the Google Play and App Store pages with the whole version
  history, the Korean store and press — *총잡이 고양이*, made by Yusu Games with a small team, published by
  Neptune, ₩20 bn in four months, day-1 retention 50 % —, the catgunner.games guides, the store
  screenshots, reviews). A small squad of cats auto-fires, a crosshair on the target, at targets with HP
  numbers and bars (mostly trees and obstacles on a top-down field) that burst into cash; idle numbers
  grow into 6.89T and 542AL. Bottom buttons Attack, Attack speed and Coin earnings with climbing costs.
  Guns are equipped by drag (a drop on a different grade swaps) and **two of a grade merge into a random
  gun of the next grade** (D … SSS, then Z, ZZ, ZZZ since August 2026); 35+ guns in classes (pistol,
  rifle, shotgun, minigun, rockets) whose type matters; 25+ cats with abilities, skins with stats, pets
  with skills; maps (forest, desert, snowfield, volcano, candy land) with bosses; **rebirth** at
  milestone stages (players rebirth every ~150) for points spent on permanent cat upgrades, merged guns
  kept; offline progress; Boss, Challenge, Hunt, Mine, Trip and Raid modes, a ranking, a season pass.
  Players love the "satisfying destruction", number-go-up, the merge moment and the rebirth's fast
  scaling; they hate forced ads, auto-merge and quick clear sold as 7-day subscriptions, enhancements
  that fail and eat their stones, and idle progress that stalls.
* **Carried over:** auto-fire with a target the player can set; targets with a number and a bar; the
  burst of currency flying to the counter; the three upgrades with exponential costs and a shop for
  more guns; drag to equip, swap and merge, two of a grade into a random toy of the next grade; families
  that fire differently and suit different targets; cats with abilities; places with bosses; rebirth
  with lasting perks, toys kept; offline rewards; big idle numbers. **Adapted:** the targets are pests
  that come for the abbey's goods and **bolt when their courage runs out — startled, never hurt**; the
  guns are toys; a boss that is too strong loses patience and comes back later (nothing is lost);
  auto-merge is free (the helping paw); offline gifts are modest and capped; the Trip becomes a kitchen
  cat's trip that ends at the next session, never on a timer. **Dropped:** gem summons, skins, pets, slot
  enhancement (nothing ever fails), ads, passes, VIP, ranking, and the Boss, Hunt, Mine and Raid modes
  (a 3–10 minute session keeps one field; the chiefs are its bosses).
* **The view.** The field of the current place under the runner's HUD (the abbey and its hills behind
  it), the abbey wall along its foot with the cats on embroidered cushions facing us, eyes on the field,
  and in the middle of the wall the gatehouse's **cat's-eye**. Below (a phone upright) or in a column on
  the right (desktop) the fish in the bowl, the **toy chest** (5 × 2) and the buttons; on a phone on its
  side the chest sits under the Mendi panel, the buttons under the score.
* **Hands.** The squad fires by itself at the pest nearest the wall (a shot already on its way counts,
  so they do not pile onto one pest). **Drag** a toy onto another of the same grade: they merge into a
  random toy of the next grade (a pop, a chime as high as the grade); onto a cat: it gets the toy (its
  old one goes back); a different grade swaps. **Tap** a toy: it merges with its mate or goes to the
  weakest cat; a cat: it purrs and fires ×1.5 for 2.5 s; a pest or the chief: the squad's target
  (a crosshair) and a "psst!" that startles it a little; an upgrade: buy (held: again and again). The
  **helping paw** (its button, **Space**) arms a cat without a toy, else merges the next pair (never
  leaving a cat empty-pawed), else hands the best toy to the weakest cat, else buys the cheapest.
  1–4 buy on a keyboard.
* **Toys** (8 families × 12 grades: wood, paint, copper, brass, silver, gold, pearl, crystal, amber,
  opal, ruby, sun; ×2.5 a grade): *Proca* (peas, one by one), *Dmuchawka* (peas in bursts), *Konewka*
  (a fan of drops), *Sikawka* (a jet through the whole line), *Kłębkomiot* (a yarn ball that bounces on),
  *Bańki* (a bubble that pops on everyone around), *Lusterko* (a sunspot that dazzles without a break),
  *Katapulta* (an apple that thumps down on a crowd). Each is ×1.5 against one kind of pest (runners,
  fliers, crowds, shells). New toys: the trunk (Zabawka, its price climbs), the nap's gift, a chief, a
  golden pest, a new cat's first toy, the watch kept while away; a full chest keeps gifts waiting.
* **Pests and places.** Six places of the abbey, five stages each, the fifth a chief: *Winnica* (fox
  cubs, sparrows; Stary Lis — a leap aside), *Spichlerz* (mice, rats; Król Szczurów in a straw crown —
  calls his mice), *Sad* (starlings, crows; Hrabina Wrona in pearls — flies up out of reach), *Warzywnik*
  (snails, hares; Wielki Kret with spectacles — digs in and comes up elsewhere), *Staw* (cormorants,
  otters; Czapla Siwa — a gust of wings blows the shots aside), *Skryptorium* (silverfish, moths, book
  beetles; Mól Książkowy — a cloud of book dust). Pests come in groups, walk, hop, swoop or scurry to a
  spot on the goods and nibble; a hit makes them flinch, a golden one carries a toy. A chief comes after
  the boss stage's short wave with a **patience** bar; too slow, he backs off and a few of his pests come
  before he is back, wounds kept (from session to session too). A chief chased off gives his place
  **stars** — one, two at his first visit, three with half his patience to spare — and the map keeps the
  best (the level loop's goal). Courage grows ×1.24 a stage, fish ×1.18; after the scriptorium the year
  comes round and the places return, bolder.
* **Push — Czujność (alertness).** In a sighted push past the lead-in (5 s Mendi, 2 s HALO) the squad's
  pace is **×(1 + 2·level)**: ×1 below, ×2 at the threshold, ×3 well above it; every cat's eyes turn gold
  above the threshold (Bursztyn's alertness counts double there). Drawn large on the gatehouse: the
  cat's-eye's ring is the gauge (its notch at the top is the threshold, gold beyond it, a dotted ghost
  of the raw level during the lead-in), the pupil narrows to a slit, "×2,4" under it; the panel's gauge
  is the same quantity (*Czujność*). Push blocks bring pests a little faster. **A held focus** (5 s / 3 s)
  fills **the Great Hunt** inside the eye (a chased pest in a sighted push adds a little, any chased pest
  a very little): ready, the eye beats gold — tap it or Space (by itself after 5 s): for 4 s every cat
  leaves its cushion and pounces, pest after pest, and a chief loses 18 % at once.
* **Rest — Drzemka (a nap in the sun).** No pests come; the pests on the field doze ("z"), the cats curl
  up, the eye's lid drops and its ring fills blue with calm (the panel's *Drzemka*); a chief's patience
  waits. Calm ripens the grapes into fish (a little even without a signal), and the nap ends with **a
  toy in the chest**, one grade higher after a calm nap. Hands are free to merge and buy: the rest is the
  game's "prepare" time.
* **Blind — Zmierzch (dusk):** every 4th push from the 3rd session; the field darkens, the eye asks
  "?", the squad fights at ×1; at the end the block's share above the threshold fills the hunt at once
  and is told ("Czujne: 70 %").
* **The economy.** Fish from every pest chased (× the bowl and the perks); *Celność* (+10 % a level,
  ×2 every 25), *Zwinne łapy* (+3 % a level, to 50), *Pełna miska* (+10 % fish a level), *Zabawka* (a toy
  of the trunk's grade). Cushions open at the furthest stage 3, 6, 11 and 16 (six cats on the wall).
* **The vintage (Winobranie).** From stage 31 (the year come round) the player may hold the vintage:
  golden fish for the furthest stage, and the year starts over (stage, fish, upgrades); toys, cats,
  perks and records stay. Golden fish buy lasting perks in the lobby: *Bystre oczy* (+50 % power a
  level), *Pełna spiżarnia* (+50 % fish), *Kufer brata* (the trunk a grade higher), *Ciepły parapet*
  (riper naps, a better gift), *Mistrzowie łowów* (the hunt), *Skrót przez sad* (a year starts further
  on), *Nocna warta* (the watch kept while away), *Gawęda brata* (+5 s of a chief's patience).
* **Offline.** Back after two minutes or more: "while you were away the cats kept watch" — the fish of
  1.2 % of the fighting income for the time away, at most 8 hours (about one session's worth), and a toy
  after an hour.
* **The cats** (twelve, by play): Mruczek (purrs: the cats beside him +15 %) and Rudy (courage +25 %)
  from the start; Kluska (fish +40 %, naps +20 %) at stage 3; Psotka (pace +30 %) after Stary Lis; Sadza
  (shots go through) after the Rat King; Śnieżka (an icy stare stops a pest) after the Countess; Tygrys
  (+60 % on chiefs) after the Mole; Szperacz (finds toys) after the Heron; **Pangur Bán** (every 4th
  shot ×3 — the white cat of the old Irish poem, who hunts mice while his monk hunts words) after the
  Bookworm; Mama Mila (the hunt charges 25 % faster) at the first vintage; Bursztyn (golden eyes) after
  5 Great Hunts; Baron (splash) after 7 sessions. A new cat brings a toy; the lobby moves cats between
  the wall and the kitchen. **Trips** (after the original's newest content, "Trip", without its timers):
  a kitchen cat can go on a trip to the neighbouring farms and comes back at the next session with fish
  (90 s of fighting's worth) and a toy a grade above the trunk's — the "ready tomorrow" of the meta.
* **Companion.** Brother Anselm, old and kind, in a round portrait at the wall's end (on a phone upright,
  in the field's top corner, where the cats leave him room): 24 moments × 3–4 lines
  (the opening, every block, a good stretch of alertness, the hunt, merges, a nap's gift, a new cat, a
  chief and his trick, a chief chased or backing off, nearly, a new place, the vintage, petting, the
  return, the full chest, the end). Running jokes: his soup, his knees, the prior's funny looks at naps,
  Rudy's vanity. Never over a telegraph, the banner or a card.
* **Story.** The opening card (the first session) with Song 2:15; a card for every place made safe
  (the next place told in two lines); the vintage's card; the watch-while-away card; the brother's
  closing line in the summary.
* **Teaching.** The first session opens with the warm-up and two old toys in the chest; coach marks,
  one at a time when each first matters: the squad fires by itself → merge (again after 22 s if not
  done) → hand it to a cat → buy an upgrade → the helping paw → the eye and its threshold → the hunt →
  the nap → the chief → a golden pest (target it) → petting. Later sessions only what is new (dusk,
  a full chest, the vintage).
* **Headline.** Pests chased off this session (a chief counts five), the same number as the result;
  under it "Etap 7 · Winnica", the chief's name while he is here, or "Etap 7 · 12 do rekordu".
  **Closing:** the first session Song 2:15; a chief chased Proverbs 27:18; a vintage or the watch kept
  while away Proverbs 6:6-8; a calm nap (pests and cats dozing together) Isaiah 11:6; petting or a new
  cat Proverbs 12:10; many birds chased off Matthew 6:26; a Great Hunt or a new pest in the notebook
  Job 12:7; else Song 2:15.
* **Pace.** A simulated week of 5-minute sessions with the helping paw every 2 s: the first session
  reaches the first chief and two or three places, the year comes round (the vintage) around the third
  session, and progress slows after it until the vintage's perks carry the watch further — the idle
  curve, without a wall that ends the fun (a chief who backs off always comes back).
* **Reverence (§11.5).** Pests are startled and run off; nothing is hurt. The brothers are warm and
  funny, never mocked for their faith. No wine jokes: the grapes are harvested and that is all (the
  vintage's feast is fish baked from dough). The abbey cats, the vineyard and the little foxes are this
  game's symbols.

Files: `rules.ts` (every number), `content.ts` (places, pests, chiefs, toys, cats, perks, lines),
`meta.ts` (progress `ver: 1`, the placeholder's save migrated, cushions, upgrades, the vintage), `sim.ts`
(the session), `talk.ts`, `layout.ts`, `paint.ts`, `render.ts`, `intro.ts`, `preview.ts`, `panel.ts`,
`audio.ts`, `i18n.ts`, `index.ts`; tests in `test/arcade-koty.test.ts`.

**Mobile first (2026-11-12, §12).** Idle Cat Gunner is played upright with one thumb: the merge chest and
the buttons under it are the hand's whole job, the field above is to watch. Kocia straż was laid out on a
desktop and squeezed onto a phone (a UI scale of `min(w / 430, h / 640)` floored at 0.78 drew the button
names and costs at 8 px, the stage's bar at 9, a toy's grade at 6, and kept 56 px empty at the bottom for
the simulator's switch). Now the phone is the reference (`layout(w, h, insets)`, `u` = the kit's `uiScale`:
1 on a phone, up to 1.3):

* **Upright: the thumb zone is the hand's.** The field runs from the HUD down; a bar over its top edge holds
  the fish (a chip — where the fish fly) and the stage (the wave's bar, or the chief's courage and
  patience). Then the wall, and on the bottom edge, over the home indicator, the hand's part: the
  **chest** (5 × 2, cells 56 px on a 360 px phone, up to 64 × u where the band has room) and the **row of
  buttons** (the three upgrades, a toy, the paw; 54 px tall, nothing in the screen's outer 16 px): a
  button's name on one or two lines at 13 px (German's "Spielzeug" at 11.5), its cost at 13 px with a
  fish, a stripe of its icon's colour on top; a tablet's wider buttons keep the icon, the effect and the
  level. The field gets the rest: 114 px on the smallest phone (106 before), 178 on an iPhone in Safari
  (138), 365 in an installed app.
* **Six cats on a 360 px wall.** The sim's cushion spots put six cats 43 px apart, too close for a
  finger, so the view seats them itself (`wallRow`): two groups around the eye, every cat and the eye a
  target of 44 px or more, 6 px apart; the groups keep 16 px from the edges and give up to 8 px of it only
  for six cats on a 360 px phone. A fresh shot leaves the drawn cat and eases onto the sim's path.
* **Under a finger.** A press shows at touch-down (a tray sinks, a button goes down and darkens — never
  shrinking its words —, a cat gets a ring). A toy dragged past 10 px floats a cell's height above the
  finger (a mouse lifts it a little) and lands on the nearest cell or cat within reach: it is pulled
  toward it, the landing place is ringed (gold for a merge) and the other mates pulse; let go over
  nothing, it goes home. A tick on the pick-up and on a snap onto a mate, a buzz on a merge, an equip, a
  buy. Held, an upgrade keeps buying and the paw keeps helping. The paw button is Space on the screen:
  a ready hunt first (it turns gold, "Łowy!"), so the Great Hunt is in the thumb zone too. A tap on the
  field takes the pest nearest the finger on screen (30 px and more), not in the squashed field's units.
  One finger at a time — a new one takes over, so nothing sticks. Resting hands see a mergeable pair
  shimmer after six seconds.
* **On its side** (601 × 360, the HUD one 68 px row, the chart a column on the right): three columns —
  the chest as 2 × 5 (cells 48 px) under the left thumb, the field and the wall in the middle (room for six
  cats and the eye in one row), the five buttons one above another under the right thumb, each with its
  icon, cost and effect (a long name takes two lines and leaves the effect out); the wall stands 14 px
  above the bottom so the eye's word reads under it. The vintage is a compact grapes button on a phone
  (its card says what it does). On a desktop the column on the right stays, with no empty band under it.
* **Words for the hand.** With a finger the how-to has a line for the Paw where the keys were, and the
  coach marks say "stuknij oko albo Łapę"; with a keyboard the keys stay as shortcuts ("Łapa · ␣",
  Space, 1–4).
* **Cards, marks, the brother.** A story card and the vintage's question are a bottom sheet on a phone
  (the play is frozen under them, so they may cover the controls): words at 15–16 px, the verse at 13–16,
  its reference at 12 (the kit's own floor is 10), the two answers in the thumb zone. The runner's coach
  bubble sits above its point, so a mark about a button or the vintage is centred over the field while
  the control itself glows, a mark about the chest points at its top edge, and a field mark stands low in
  the field, under the HUD; Brother Anselm (the field's top corner, 14 px words) finishes his line before a
  mark and steps aside for an urgent one, and fades while a toy is carried over the cats. Numbers float
  only inside the field.
* **Measured** (`scripts/arcade-mobile.mjs`; small phone / iPhone / large phone / on its side / tablet /
  desktop): strings under 11 px 33 / 29 / 7 / 44 / 2 / 1 → 0 everywhere; at 11–13 px 34 / 30 / 58 / 46 /
  1 / 10 → 4 / 2 / 2 / 5 / 0 / 0 (the eye's "próg" tag, the verse's reference, the effects on a phone on
  its side); targets: none → 22, all ≥ 44 px, inside the insets, no overlaps; the game's frame 0.97 ms on
  a desktop (1.08 before). The layout test audits the targets at every `CHECK_SIZES` entry with one to six
  cushions, the vintage, a story and the vintage's question.

## 12. Mobile first: every game plays on a phone held in one hand

On 2026-11-12 the founder asked: *"modify all these games to be playable on mobile devices (mobile
first). support both desktop and mobile versions."* The originals of §11 are phone games, played upright
with one thumb; ours were laid out on a desktop and squeezed onto a phone. Measured with the audit
(§12.4) before this round, on an iPhone in Safari (390 × 664 CSS px):

* the runner's HUD and the signal dock took 40 % of the height, and a phone on its side kept a third
  of its 360 px for play (the panel, the bar above it and a 96 px dock);
* the games drew their own labels at 6–9 px (a UI scale of `min(w / 900, h / 640)` clamped to 0.72);
* the simulator's switch sat bottom left, in the thumb zone, and every game kept 54–62 px empty for it;
* hints spoke of keys ("albo WASD / strzałki") to a player without a keyboard.

### 12.1 The order of design

1. **A phone upright** — the reference. The smallest canvas that must play well is 360 × 500 with the
   chart on (a small Android phone in Chrome): a 366 px band between the HUD and the dock.
2. **A phone on its side** — 601 × 360 with the chart as a column on the right, 812 × 360 without it;
   the HUD is one 68 px row.
3. **A tablet** and **a desktop** — the same layout grown (`uiScale` up to 1.3), never a separate game;
   keys stay as shortcuts.

### 12.2 The contract (`kit/mobile.ts`)

| Rule | Number | Why |
|---|---|---|
| Tap targets | ≥ 44 px on the short side (48 for a primary control), ≥ 6 px apart | Apple's 44 pt, Material's 48 dp; a thumb is ~10 mm |
| Any canvas text | ≥ 11 px | under it a phone held at arm's length shows a smudge |
| Text to read to play | ≥ 13 px (cards, bubbles, a button's label) | reading speed, not just legibility |
| Thumb zone | the bottom 45 % of an upright phone | where a thumb reaches without changing grip: the recurring controls live there |
| The top band | passive information only | it is the HUD's, and the farthest from the thumb |
| One hand | tap, drag, hold; no two fingers, no hover, no keys required | the other hand holds the phone (or adjusts the band) |
| Edges | nothing to press in the outer 16 px of an upright phone | Safari's back swipe starts at the left edge; the home indicator at the bottom |
| Under a finger | what a drag moves is drawn above the finger | a merged toy, a dragged card must stay visible |
| Frame budget | the game's update + draw ≤ 4 ms on a desktop | ≈ 16 ms on a mid-range phone, which is 60 fps |

Each game declares its tappable controls in `ArcadeGame.targets()` (hit rectangles as the game tests
them), and its layout test runs `auditTargets()` at every `CHECK_SIZES` entry: the sizes and insets
measured on the devices above. `uiScale(w, h)` is 1 on any phone and grows to 1.3; `fitText()` shrinks a
label to the floor and then ellipsizes it, never below `MIN_TEXT`; `hitRect()` grows a small icon's hit
area to a finger.

### 12.3 What the runner does

* **One compact HUD band on a phone.** Upright: the time as a 3 px line along the top edge, the clock
  and the buttons, then the panel — the block, its seconds and the gauge in one row over two lines of
  what to do in the head (the next block's telegraph takes that line for its few seconds) — beside the
  score: 134 px instead of ~180. On its side: one 68 px row (the panel, the score, the clock and the
  buttons). The panel's gauge name and the verdict line live in the banner and the dock.
* **The bottom is the game's.** The simulator's switch moved into the top bar ("▲ Skupienie" on a
  phone); the signal note moved under the HUD; `insets().bottom` is only the home indicator.
* **The chart stays in sight** (§7.7: the founder asked for it): on a phone upright a 100 px strip (the
  chart, now, the last block); on its side a column on the right, so the game keeps its height.
* **Full screen on Android** from the "Graj" tap (an installed app already is; an iPhone cannot); leaving
  the game leaves full screen.
* **Adaptive resolution**: two slow windows of 2.5 s (mean frame over 24 ms) lower the canvas by half a
  device pixel, down to 1; it never goes back up in the session.
* **Coach marks wait for the block banner**, and one on screen when a banner comes returns after it.
  On a phone a block's banner says what the block drives only the first time per kind; after that it
  is the block and what to do in the head (two lines over the play instead of four).
* **The chart does not swallow the thumb.** On an upright phone the dock is where a thumb rests: a
  touch there (never the mouse) plays as a touch on the nearest point of the canvas's edge, the whole
  gesture shifted alike, so a tap stays a tap and a drag a drag — a jump, a joystick, an aim.
* **`insets()`** tells a game what covers each canvas edge: the HUD band, the home indicator, the notch
  of a phone on its side (an edge the dock covers is 0). **`touch`** says the primary input is a finger;
  the how-to card leaves out the keys there.
* The calibration, pause and help cards are tighter on a phone, each control's chip above its line.

### 12.4 The audit (`scripts/arcade-mobile.mjs`)

Headless Chrome emulates the devices from the first page load (touch, user agent, pixel ratio): a small
Android phone (360 × 600, 4× slower CPU), an iPhone in Safari (390 × 664), a large Android phone
(412 × 780), a phone on its side (812 × 360), a tablet (820 × 1180) and a desktop (1280 × 800). It plays
with touch — the game's `targets()`, drags and taps in the free area, the simulator's switch — and
reports every canvas string at its largest size (under 11 px fails, under 13 px is listed), the targets
(size, bounds, overlaps), the frame rate with the CPU slowed like a phone's and the game's own frame
time, the HUD band and the share left for play, whether the calibration card fits; with screenshots per
device.

### 12.5 Each game on a phone

Each game's own section (§9.2–§9.4, §11.6–§11.9) ends with a "Mobile first" part: what moved into the
thumb zone, how the controls feel under a finger, the sizes, the landscape layout, and the measured
results.

### 12.6 The other fourteen (2026-11-12, round 7)

The first mobile-first round covered the seven games of §11. Its report said the other fourteen had only
the shared shell and still drew text as small as 6–9 px; the founder answered *"fix the rest issues"*.
Seven builders took two games each, with the same contract (§12.2) and the same audit (§12.4); the lead
fixed the shell issues they and the first round found:

* the calibration card fits a phone without scrolling — how to play turns through short pages, the dock
  lends its room, a phone on its side gets two columns (it scrolled ~600 px on a small phone);
* flying words (`Floaters`) accept a family, a weight and a family, or a whole font — three games had
  handed it a weight, which made an invalid font and the canvas's 10 px default;
* `fitText` shrinks step by step before it cuts; a verse's reference line is never under 11 px.

Canvas strings under 11 px, iPhone in Safari / phone on its side, before → after:

| Game | Before | After |
|---|---|---|
| Posłaniec | 104 / 105 | 0 / 0 |
| Zastępy | 69 / 65 | 0 / 0 |
| Latarnik | 53 / 62 | 0 / 0 |
| Pasterz | 46 / 38 | 0 / 0 |
| Firmament | 44 / 58 | 0 / 0 |
| Zacheusz | 24 / 21 | 0 / 0 |
| Anioł Stróż | 22 / 31 | 0 / 0 |
| Glina | 17 / 16 | 0 / 0 |
| Geoda | 9 / 18 | 0 / 0 |
| Źródła | 5 / 5 | 0 / 0 |
| Wzlot | 4 / 4 | 0 / 0 |
| Urodzaj | 2 / 2 | 0 / 0 |
| Motylarnia | 1 / 2 | 0 / 0 |
| Arka | 1 / 2 | 0 / 0 |

Every game now implements `targets()` and tests `auditTargets()` at every `CHECK_SIZES` entry, keeps no
reserve for the old simulator switch, and speaks of tapping and dragging on a touch screen (keys only as
a desktop's shortcuts, in a how-to row the runner drops on touch). What each one changed:

#### Geoda

**Mobile first (round 7, 2026-11-12).** Block Blast is played upright with one thumb: the board across the
screen, three pieces under the thumb, a piece lifted well above the finger as it is dragged. Geoda kept
the desktop's order on a phone: a 56 px strip (the dial, the goal, Bazyl) between the board and the tray,
so the small phone's board was 208 px (26 px cells) with 70 px of empty margin either side; the dragged
piece floated 30 px above the finger, under the thumb; the opening card squeezed Isaiah 54:11–12 to 10 px.

* **Two upright shapes, the bigger board wins** (`layout.ts`). *Strip* (a large phone, an installed
  app): the dial, the goal (the bowl in a Szlif) and Bazyl in a strip right above the board, his bubble
  under it. *Columns* (a small phone, an iPhone in Safari, a tablet): the shine is a column of five steps
  in the board's left margin (×1 at the foot, gold from ×3 with the threshold's notch, ×N in big type; the
  bowl in a Szlif), the chamber's jewels and their counts in the right margin, Bazyl under them, his bubble
  over the board's foot; the plates may cover the rind's rough outer half, never the board. The board sits
  on the tray (a short drag); spare height grows the tray (80 → 150 px), then the strip. Cells: small phone
  26 → 30 px, iPhone 33 → 34, tablet 78 → 81; the large phone's 40 and the installed iPhone's 39 overlap nothing.
* **The tray under the thumb.** Three slots ≥ 80 px tall across the bottom, 16 px off the edges, the
  pieces sized to the slot; a slot lights and its piece swells on touch-down (and a 6 ms tick); `targets()`
  are the slots with a piece in them (the story card while one is up).
* **The drag, phone first.** A dragged piece is centred over the finger with its lower edge 56 px and more
  above it (a cell under a mouse), so the thumb never covers it, and it snaps to the nearest spot where it
  fits within 1.35 cells (0.95 with a mouse): the ghost and the lines it would clear show there, a light tick
  says it found one. A press that moves 10 px is a drag. The piece is drawn at the board's size and scaled
  (no sprite per frame); Bazyl's bubble steps back to 22 % while a piece is in the air.
* **Readable.** Every word fitted with a floor (kit `fitText`) instead of fillText's maxW squeeze: the
  goal's counts across the plate at 13+ ("10/11" fits a 40 px column), the Szlif's line in two lines at
  13 px (the bowl column's word and polish only where they fit at 13), "nie pasuje" 13+ with a rim (two
  lines where a language needs them: "får inte / plats"), the dial's ×N 15+, its label and digits 13 (the
  digits only on a dial ≥ 44 px), Bazyl 14 px; a narrow goal box leaves the chamber's name to the HUD.
  The story cards are the whole band on a phone (they wait for the tap): title 20–32, text 15–17, the
  verse 13–18 px with its reference at 13. A test plays a focus block and a Szlif on every phone size in
  all four languages and finds no word under 13 px.
* **On its side** (601 × 292 under the HUD row): the dial, the bowl and Bazyl on the left, the board in the
  middle with its foot and skyline on screen, the goal over the three slots stacked under the right thumb.
* **Words for the hand.** "Stuknij planszę — kawałek sam ląduje w najlepszym miejscu" with a finger;
  "Kliknij planszę albo naciśnij Spację…" and "1–3" only with a keyboard (`how.tap.keys`, four languages);
  the registry's tip no longer names Space.
* **Fill rate.** No shadowBlur per frame: the jewels glow with a halo, the dial's gold with a wide stroke and
  a disc, the bowl's ring with a stroke, the bubble and the dragged piece cast offset shapes.
* **Measured** (scripts/arcade-mobile.mjs, 50 s): under 11 px 7/8/0/18/0/6 → 0 and under 13 px
  16/15/11/25/5/2 → 0 on small/iPhone/large/side/tablet/desktop (German, Swedish and EEG too); targets
  none → the story card and three pieces; game ms 2.47/1.18/1.86/1.79/1.52/0.99 → 1.68/1.00/1.66/1.03/0.90/0.78.

#### Latarnik

**Mobile first (2026-11-12, §12).** Pop the Lock and Knife Hit are played upright with one thumb, the circle
filling the screen; Latarnik was laid out on a desktop and squeezed onto a phone — a UI scale of
`min(w, h) / 430` floored at 0.84 drew the night's name, "zasięg 62%" and "próg" at 8.8–9.2 px (54–65 strings
under 11 px per phone), a 66 px band stayed empty under the deck (the old simulator reserve), the sea had a
115 px radius on a 360 px phone and the boats 20 px. Now the phone is the reference (`layout(w, h, insets)`,
`u` = the kit's `uiScale`: 1 on a phone, up to 1.3):

* **Upright: the sea as wide as the screen.** The whole screen is the button, so the layout has one job —
  the largest round sea with the horizon's boats and the reach ring in sight (`SEA_PAD` 1.07 R): R 145 on
  the smallest phone (was 115; 80 % of its width), 175 on an iPhone (90 %). Right under the HUD a 44 px row
  holds Zośka on her post and the **night's pill** — the night and its three stars on the first line, the
  goal at 14 px under it, the count big on the right (a goal too long for one line at 13 px takes both
  lines); her bubble (14 px) and the cards (amber, the blind reveal, an upgrade: one line of title, one of
  detail) take the pill's place while they show. The lanterns and the perfect ladder sit in the band's lower
  corners, clear of the horizon's boats — the ladder's words only where they fit ("×3" else); where the band
  is taller than the sea (a large phone, an installed iPhone) they form a row under the sea and the card goes
  under them. The rest of the band is the thumb's: it taps there without covering the sea.
* **Under a finger.** A touch anywhere flashes on touch-down — the sea, the free band, the chart under the
  game (it reaches the game as a touch on the canvas's edge), the opening card (any tap closes it, its one
  target); the beam flares at once, an empty flash dims the lamp and draws its recharge. Boats are at least
  24 px (were 20), a flotilla's numbers 13 px on their badges; the haptics stay. Nothing needs a key: with a
  finger the how-to has one row (tap anywhere) and the lesson's coach mark says "stuknij teraz"; on a desktop
  the keys' row stays and the lesson and the opening card say "kliknij albo naciśnij Spację".
* **Words at 360 px.** `font()` floors at 11; what is read to play is 13 px or more — the goal 14, Zośka 14,
  the cards 15/13, the between-nights card 14.5/13.5, the opening story 14.5 (13.5 on the smallest phone when
  the verse would not fit whole, so Mt 5,14–16 reads whole in German too) with the verse at 13–16, the titles
  over the sea fitted down to 15 at most. The ring's words sit on dark plates: "zasięg 62%" 13 px, "próg"
  and "wczoraj" 12. Left at 11–13: the night's name in capitals (12), "próg" (12), the verse's reference (11).
* **On its side** (601 × 360, the HUD one 68 px row): the sea takes the band's height on the right (R 132, was
  112); a 280 px column on the left holds the lanterns and the ladder with its words, the pill, the card, and
  Zośka at its foot with her bubble beside her. **A tablet** upright is a big phone (R 368); **a desktop**
  keeps the sea rising between the panel and the score (R 288), the columns beside it.
* **The frame.** The titles' blurred shadow (`shadowBlur` every frame) is a dark rim now (`strokeText`).
* **Measured** (scripts/arcade-mobile.mjs, before → after): strings under 11 px — small phone 60 → 0, iPhone
  56 → 0, large Android 54 → 0, on its side 65 → 0 (tablet, desktop 0 → 0); under 13 px — 17, 10, 21, 14, 3, 4
  → 4, 3, 3, 3, 0, 0 (the night's name, "próg", the verse's reference); targets: none → the opening card while
  it shows (finger-sized, inside the insets); the game's own frame 1.4–2.7 ms with the CPU slowed 2–4× (60 fps),
  0.7 ms on a desktop.

#### Motylarnia

**Mobile first (2026-11-12, §12).** Slither.io and Snake.io are played upright with one thumb that steers
from wherever it rests; Motylarnia now is too. Before, the caterpillar turned toward the finger itself — on
a phone the finger had to sit over the garden ahead of the head (a thumb resting low could only steer
down) — and a press held still for 0.22 s sprinted, costing tail, by accident; Hieronim and his bubble sat
bottom left and the side goal's pill bottom right, under the thumb (on a small phone his bubble covered the
caterpillar spinning its chrysalis); a new garden's card came with the runner's block banner and hid under
it; the flowerbed's "~5 s" was 10 px. Now (`computeLayout(w, h, insets)`; `u` = the kit's `uiScale`):

* **A floating stick under one thumb** (stick.ts). Its base appears wherever the thumb lands; past a 10 px
  dead zone the caterpillar turns toward the drag's direction; a push past the rim (1.15 × the 46 px base,
  a dashed gold ring) sprints — the ring turns solid gold with a 10 ms tick — and pulling back inside
  stops; a finger pulled far drags the base along; lifting keeps the heading; a quick tap without a drag
  still turns toward the tapped spot (the original's "point or tap"). The thumb never covers the caterpillar
  or the garden it crawls into: on a phone upright the camera holds the head at 44 % of the play's height,
  leaving the lower part to the stick, and the play shows the garden at 1 px per unit or more (was
  0.84–0.9; the caterpillar ~70 px long on a 360 px phone). With a mouse nothing changed (the pointer
  steers, a held button or Space sprints, ←/→ turn).
* **The band under the HUD** carries the passive things: Hieronim top left, his bubble hanging beside him
  (14 px, at most four lines), the side goal's pill beside him (14 px, the whole row until the twig needs
  its place), the twig top right (its branch only as long as its chrysalises need; "wylęg na końcu sjesty"
  13 px on a plate). Hieronim keeps quiet while a coach mark shows; the rare flower's arrow keeps below the
  band; the flowerbed stays along the bottom (the band's last 40 s in the world), its delay tag 13 px on a
  plate.
* **Cards.** The opening story fits a 360 × 328 play area at 16 px — the title 26 px, 2 Corinthians 5:17
  at 16 with its 13 px reference, "Stuknij, by zacząć ›" ("Kliknij albo naciśnij Spację…" at a keyboard) —
  in four languages at every checked size; it waits up to 12 s (was 7) and closes on any tap. A new
  garden's goals (22/15 px) come as a sheet over the flowerbed on a phone upright, clear of the runner's
  banner and near the thumb that closes it. Each card is the game's one `targets()` entry while it shows.
* **Words for the hand:** a finger hears of dragging ("Przeciągnij palcem w dowolnym miejscu…", "Pociągnij
  palec dalej, za brzeg koła: sprint"), a mouse of pointing, the button and the keys (`teach.*.keys`,
  `how.*.mouse`); the lobby's tips speak of dragging. `font()` floors at 11 px.
* **On its side** (601 × 360) the same arrangement fits a 254 px play area (Hieronim and the pill top left,
  the twig right, the story 460 px wide); a tablet and a desktop grow it (u 1.3; the desktop keeps its
  zoom and its centred camera).
* **Measured** (six devices, 50 s): 0 strings under 11 px and 0 under 13 everywhere (was 1 and 7–10 on
  each; German and HALO too); the cards the only targets, finger-sized and inside the insets; the game's
  own frame 0.96 ms on the desktop, 1.0–3.0 ms on phones at 2–4× CPU slowdown while seven audits ran.

#### Arka

**Mobile first (2026-11-12, §12).** Arrows – Puzzle Escape is played upright with one thumb: a tap sends an
arrow, the board fills the screen. Arka was laid out for the old HUD and a desktop: its bar carried the dove's
42 px button with a 10 px "Gołąb" at the top, far from the thumb; the boards are portrait-shaped (3×4 … 9×11)
while a phone's deck area is landscape-shaped, so the cells shrank to 29 px at level 12 on the small phone; on
its side the old "compact" layout left a deck of 12–34 px cells beside an empty meadow; and a tap sent the
animal on touch-down. Now the phone is the reference (`layout(w, h, insets, cols, rows)`, `u` = the kit's
`uiScale`: 1 on a phone, up to 1.3; `font()` never under 11 px):

* **The deck turns a quarter** when that gives larger cells — a pure mapping of the view (`toScreen`, `toSim`,
  `sdir`): the board's cells, the animals' directions and every rule stay the same. Small phone, levels 2 / 6
  / 9 / 12 / 20: 52 / 44 / 33 / 29 / 24 → 60 / 56 / 40 / 34 / 26 px; iPhone in Safari 64 / 54 / 40 / 36 / 29 →
  68 / 61 / 46 / 40 / 33; on its side 18 / 18 / 12 / 12 / 12 → 63 / 53 / 39 / 35 / 29; a tablet's small decks
  grow to 110.
* **Upright:** the bar right under the HUD (passive: hearts, the level at 15 px and its par at 13, the raven
  perched on its right end), the deck as large as the band allows, the gangway, and the new land at the
  bottom where the firsts of their kinds wait — with, in the bottom-right thumb zone, **the dove's button: a
  52 px pill with the bird and its name**, pressed under a finger, shaded while the dove rests.
* **Under a finger.** A touch picks the animal under it — on an empty cell the nearest one within a finger's
  reach (its cells grown to 44 px where the neighbours leave room) — and shows it at once: its cells ringed,
  the animal lifted, and on a deck of cells under 52 px a bubble above the finger with the animal big, turned
  the way it will walk (the finger hides the animal itself). Sliding picks the one now under the finger,
  lifting sends it, sliding off the deck lets it be: a heart is never lost to a finger that landed on the
  wrong animal. The pick never tells whether the way is free — that stays the puzzle and the mist's reward.
* **On its side** (601 × 360): three columns — the bar as a card (hearts over the level and the par) with the
  raven under it, talking in his own column; the deck as tall as the band; the new land and the dove's pill
  under the right thumb, the waiting animals in two rows over it.
* **Cards and words.** The level's pill grows with its subtitle ("Jeszcze raz — pary zostają" stays 13 px),
  the stars card's tap line is 13 px, the opening passage at least 13. With a finger the how-to keeps the
  dove as a tap ("Gołąb na łące: stuknij…" — before, a phone's how-to lost the dove, a `keys` row) and its
  coach mark says "stuknij gołębia na łące" instead of "(spacja)"; with a keyboard Space, H and the arrows stay.
* **Measured** (small / iPhone / large / on its side / tablet / desktop): strings under 11 px 1 everywhere
  ("Gołąb" 10) → 0, German too; at 11–13 px 21 → 2 (the verse's reference at 11, the mist's "próg" tag at
  12); targets: none → the dove's pill (48–64 px, inside the insets) and a card that takes the tap; pairs in
  the audit's 50 s 0 → 2–5; the game's frame ≤ 2.3 ms on the small phone at 4× slowdown, 0.7 ms on a desktop
  (0.6 before). The tests check the deck in the band at every `CHECK_SIZES` entry for seven levels, the
  mapping and its directions, the dove in the thumb zone, the pick (down, slide, lift, off the deck), the
  reach, the targets answering taps, and no string under 11 px at every size on a recording context.

#### Urodzaj

**Mobile first (2026-11-12, §12).** Suika is held upright and played with one thumb: drag anywhere, the fruit
follows along the top, let go. Urodzaj already played that way; what the phone lacked was room and words: a basket
195–210 px wide on a 360 px phone, the next fruit in a 28 px bubble with a 10 px "Następny", the circle of fruits as
18 px icons, "Pokłosie" at 10 px, and hints that spoke of the mouse and the arrow keys.
* **The basket first** (`layout.ts`, upright): as wide as the band allows — its ground on the circle of fruits, a
  strip of eleven icons (20 px and up) along the bottom 16 px off the edges, in the thumb zone. The next fruit's
  bubble takes whichever place leaves the basket wider: a margin of its own beside Feliks's twine (a narrow phone:
  the basket 191 px, its height the limit anyway) or a row under the HUD (a wide or tall phone, an installed app:
  the basket 254–313 px). The bubble is 44 px and up with the fruit at 72 % of it and "Następny" at 13 px on a
  light plate; it never touches the wall or Feliks's flight.
* **Under a finger:** a finger anywhere aims — the hanging fruit is at the top, so it is always above the finger,
  and the lower half of the basket lies in the thumb zone; the release drops; a tap drops where it lands (the
  how-to's third line on a phone). The touch is answered at once: Feliks flies over and a soft ring shows where the
  finger came down. One finger at a time (a second one is ignored until the first lifts). Haptics as before.
* **No buttons in play**, as in Suika: `targets()` is empty while you play and is the story's or a festival's
  card while one shows (a tap anywhere on it closes it).
* **Feliks's line** (14 px, up to four lines) stands beside him on the side with room, never over the next
  fruit; where neither side holds it (a 360 px phone, Feliks mid-basket) it sits under his hanging fruit across
  the basket's empty top, its tail up to him — he and the fruit stay in sight.
* **Words and cards:** "Pokłosie" 13 px plated; the tally (16/34/14 px), a festival (19/14 px) and the mission
  pill (15 px) scale with the screen; the story card fills the band's width with 15 px words, the verse at
  13–17 px; every card stays under the runner's HUD, the desktop's risen basket too. With a finger the hints say
  "przesuń palcem w bok", "puść palec"; with a keyboard they add "myszą albo ← →", "kliknij albo naciśnij
  Spację"; the tip on the calibration card names no keys.
* **On its side and bigger:** a phone on its side keeps the wide layout (the circle as a ring left of the basket,
  the table right, the next bubble beside the twine); a tablet upright grows the phone's (u 1.3, the basket 473 px).
* **Cheaper frames:** the field (three screen-sized gradients, a sun glow over half the screen, seventy stubble
  strokes) is painted once per size into an offscreen canvas.
* **Measured** (`scripts/arcade-mobile.mjs`; small phone / iPhone / large phone / on its side / tablet / desktop):
  strings under 11 px 2 / 2 / 2 / 2 / 0 / 0 → 0 everywhere; at 11–13 px 2 / 2 / 2 / 2 / 3 / 2 → 1 / 1 / 1 / 1 /
  0 / 0 (the verse's reference); the game's frame on a desktop 0.51 → 0.41 ms. The layout test checks the basket,
  the bubble, its label and the strip at every `CHECK_SIZES` entry; a game test draws the story card, play,
  Feliks at length (mid-basket and at both walls), the gleaners, a festival and the tally at every size and
  checks the text floor and the targets; German passes on the small phone and on its side.

#### Wzlot

**Mobile first (2026-11-12, §12).** Tiny Wings is played on its side; Wzlot is held upright in one hand first —
and the hold is the whole control, so the thumb rests on the screen for long seconds. Before: a UI scale of
`min(w, h) / 430` floored at 0.8; the flying words ("×5", "Mama Cię łapie", "Słońce przytrzymane +4 s") drawn by
the kit's `Floaters` with a whole font string where it wants a family — an invalid CSS font, so the canvas fell
back to its 10 px default on every device (6–8 strings under 11 px, a desktop too); the story card, Leon and the
banners at 11.7 px on a phone; the world 1.7 screen heights across upright (the eaglet 28 px on a 360 px phone),
its ground 7 % over the foot, where the thumb holds. Now (`layout(w, h, insets)`, `u` = the kit's `uiScale`):

* **Upright: a world that reads, a thumb that never covers it.** The camera comes closer — 1.45 screen heights
  across (212 → 242 px per screen height on the smallest phone, 229 → 269 on an iPhone; the eaglet 31–35 px, a
  hill's drop easy to read), the eaglet a fifth in (was a quarter), 1.16–1.19 screen heights of slope still in
  sight ahead. The lowest ground in sight stands a **thumb pad** above the canvas's foot (16 % of the band,
  59–110 px): the earth goes on under it, and a thumb held there — or on the chart under the game, which reaches
  the canvas as a touch on its edge — never hides the eaglet or the valley it dives into. A tablet is capped at
  290 × u px per screen height: it sees more of the granie (1.74 screen heights ahead) instead of a giant eaglet.
* **The band's sun** rides its arc under the HUD as a 14 px sun, its halo, the threshold ring and the Poryw's
  charge inside the band, drawn over the cloud deck so a zoomed-out camera never hides the gauge; "W chmurze"
  12.5 px on a pale plate.
* **Under a finger.** A hold anywhere is the dive (the eaglet folds and squashes at once), letting go the launch;
  the chart under the game holds too. While the story card, the day's tally or the dawn's "tap for sunrise"
  shows, it is the one target (a tap anywhere does it). With a finger the how-to shows hold and let go, the
  first coach mark says "Przytrzymaj palec gdziekolwiek", the cards "Dotknij…"; with a keyboard the how-to keeps
  Space and ↓, and the coach mark and the cards name the mouse and Space. The registry's first tip no longer
  names Space (the calibration card turns the tips on a phone too).
* **Words at 360 px.** `font()` floors at 11; the flying words are the game's own (800 weight, 13 px at the
  least, a dark rim, kept in the band): "×5" 14.7, "Mama Cię łapie" 17, "+4 s" 18; banners fitted down to 19 px
  or broken into two lines (17 px and more: a lesson in German), laid out before Leon's bubble — which keeps
  off them — and stepping aside from the runner's coach mark; Leon 14 px; the story card 15 px with Pwt 32,11 at
  13–16 (the story 13.5 on the smallest phone if the verse would not fit whole); the tally's rows 15 px. Left
  under 13: the verse's reference (11, the kit's).
* **On its side, a tablet, a desktop:** 2.6 screen heights across, the eaglet at three tenths, cards in the band
  clear of a notch, the words grown with `u`.
* **The frame.** The cards' blurred shadow (`shadowBlur` every frame) is an offset shape; the cards opaque paper.
* **Measured** (scripts/arcade-mobile.mjs, before → after): strings under 11 px — 7, 8, 6, 6, 8, 6 → 0 on all six
  devices; under 13 px — 16, 16, 1, 17, 1, 1 → 1, 1, 1, 1, 0, 0 (the verse's reference); targets: none → the card
  or the dawn prompt on screen (finger-sized, inside the insets); the game's own frame 0.6–2.2 ms with the CPU
  slowed 2–4× (60 fps), 0.65 ms on a desktop.

#### Źródła

**Mobile first (2026-11-12, §12).** Pipe Mania is played on a phone held upright, a tap per cell; Źródła is
now too: every cell a finger's size, the dispenser and the spring's dial under the thumb.

* **The valley at a finger's size** (`layout.ts`). Cells are never under 44 px. The whole valley shows where
  it fits — a 7-wide valley on a 360 px phone (46 px cells), every valley on an iPhone (44–48 px) and up —
  and otherwise it shows through a window the camera pans by less than a cell: an 8-wide valley on a 360 px
  phone (by 24 px), seven rows on a phone on its side (by 43 px). The camera rests at either end of each pan,
  so the window always shows whole cells, and goes to the end that shows the way's open end (else the water's
  head, the keyboard's cursor, the spring); a small arrow on the frame says where the valley goes on, and a
  finger aiming at the window's edge nudges it.
* **The thumb zone, upright** (the reference: a 360 × 366 band under the HUD). The valley sits low over a tray:
  the next stone (50 px, its gold frame) and the four after it, the goal ("Cel 3/6", 14 px) and its bar over
  them, Kumka, and the dial at the right (r 27). A tap on the next stone or on the dial is Kumka's help (what
  Space does): she lays the stone where it helps, and once the way holds the goal the water runs fast. Where
  the valley leaves a band over it (a tall phone), Kumka moves up there and talks to her right.
* **Under a finger.** A finger on a cell shows the next stone there at once (a gold outline; rose where it
  cannot go) and, on a touch screen, the stone lifted over the finger, which hides the cell; the aim follows a
  sliding finger from cell to cell (a 3 ms tick), the lift lays it, lifted off the valley nothing is laid. The
  next stone and the dial are pressed at the touch (squashed, a thicker frame) and help on the lift; a thumb
  that slides off cancels. One finger plays; Space, F, the arrows and Enter stay as shortcuts.
* **The dial reads on a phone**: "próg" 13 px over it, the pace "×1,0" and "Cisza" 13 px on a plate inside
  it (they were 6–9 px), the countdown 16 px, "pod / ziemią" on two lines when blind; its name under it only on
  a desktop (on a phone the runner's panel names the gauge). Kumka's bubble is 14 px, keeps to a room of its
  own, and steps back (¼ alpha) while the water's head, the way's open end or a finger's aim is under it.
* **On its side** (601 × 360 under a 68 px HUD row): three columns — the dispenser under the left thumb (the
  next stone at the bottom, as in Pipe Mania), the valley, the dial at the bottom right under the right thumb
  with the goal and Kumka over it. **A desktop** gets the same columns grown: the dial at the top of its
  column with its name, the goal and what the help does in words, Kumka at the foot.
* **Words for the hand.** With a finger the hints and Kumka say "stuknij następny kamień" (the help's coach
  mark points at it); a keyboard gets `.keys` variants with Spacja; the how-to card has a touch row for the
  help and a keys row the runner drops on a touch screen; "the next stone is on top" became "in the gold
  frame"; the lobby's tip no longer names Space.
* **`targets()`**: every cell a stone can go on that the window shows whole, the next stone and the dial; on a
  story card, the card. The tests audit them at all nine `CHECK_SIZES` for four grids (7×5 to 8×7) at both
  ends of the pan, play the game at every size (the countdown, Kumka talking, the water, a rest, a blind push,
  four story cards) checking every string, and cover the aim and the lift, the help's press and slide-off,
  the camera keeping the way's end in sight, and the words for each hand.
* **Measured** (`scripts/arcade-mobile.mjs`, small / iPhone / large Android / on its side / tablet / desktop,
  before → after): strings under 11 px 8 / 8 / 7 / 8 / 7 / 0 → 0 on all six (the dial's "×1,0" was 6.4 px);
  under 13 px 5 / 5 / 5 / 24 / 6 / 4 → 1 everywhere (the opening card's verse reference, 11 px, the kit's);
  targets none → 38–39 (the cells a stone can go on, the next stone, the dial; the story card), all ≥ 44 px,
  inside the insets, none overlapping; the game's own frame 2.5 → 3.6 ms on the small phone at 4× CPU
  slowdown (seven audits at once), ~0.7 ms on the desktop.

#### Glina

**Mobile first (2026-11-12, §12).** Let's Create! Pottery is played upright with one finger on the clay. Glina was laid
out on a desktop and squeezed: a UI scale of `min(w / 1100, h / 640)` floored at 0.55 drew the order's "ZAMÓWIENIE" at 9 px,
Szamot's lines at 9, the glaze names at 9.2, "Gotowe" at 11.8 (70 × 29 px on a phone on its side), the level's name at 7;
the potter's hand sat under the thumb that shaped the wall; with eight glazes the swatches would have been 34 px. Now the
phone is the reference (`layout(w, h, insets)`, `u` = the kit's `uiScale`):

* **Upright.** The top band under the HUD is passive: the **order ticket** on the left (62 % of the width × 100 px:
  ZAMÓWIENIE 13 px with the live stars, the customer 16 px serif, the silhouette, the glaze and the band asked 14 px,
  the match 17 px) and the kiln standing on its shelf on the right with Szamot on top. The pot's stage runs across the
  middle (134 px on the smallest phone, 198 on an iPhone), and the **thumb zone** is a 100 px floor band: the level
  under the wheel, the master's hand at the left, **Gotowe** (124 × 52) bottom right.
* **The finger and the clay.** On a phone the potter's hand works **32 px above the finger** and follows its moves from
  where it came down — up and down picks the height, sideways narrows or widens, a rim pulled up grows from its own
  height — so the thumb never covers the clay it shapes and a touch never makes the wall jump; a ring marks the finger,
  a dotted thread runs up to the hand. Gotowe's top sits a finger's lift under the wheel line (a finger working the
  pot's foot stays above it), and Gotowe answers on touch-down but acts on the lift: a finger that came down on it and
  moves shapes the clay instead. Szamot keeps quiet while a finger works the clay or a piece is glazed on a phone (his
  bubble would hang over them) and speaks at 15 px under the kiln. A mouse still works the clay directly.
* **Glazing as a bottom sheet.** The palette (`palette(L, glazes, patterns)`) puts the first three colours beside Gotowe
  in the bottom row (Gotowe where the wheel's is), the rest five a row above, the patterns' chips above them (no row
  while only one pattern is owned): 48 px swatches with the order's colour marked, 46 px chips drawn in the brush's
  colour, each pressed on touch-down; the ticket shrinks to the customer and the glaze line while glazing, so even with
  all eight glazes and five patterns the piece keeps a 92 px stage on the smallest phone (204 px with the starter
  palette). Coach marks for the palette point above the sheet, never over its swatches.
* **Cards and words.** Cards 23/17 px with "Stuknij, by dalej" on every one, each a tap target; the customer's reaction
  18/14 px; the gauge's word 14 px; `font()` floors at 11 and every canvas string is at least 13 px on all six devices;
  the sleeping cat's "z" is drawn. On a phone the how-to's hands drag / drag / tap and its keys row is left out; on a
  desktop the keys row ("Spacja kończy etap … 1–8 — kolory") and the Gotowe mark name Space.
* **On its side** (601 × 360, the HUD one 68 px row): ticket | wheel with Gotowe right of it | kiln, the level's and the
  master's names 13 px where the floor band has room; glazing puts the colours along the bottom with Gotowe at the row's
  right end under the right thumb, the patterns over them. **A tablet and a desktop** grow the same layout (`u` 1.3).
* **The frame budget.** No per-frame `shadowBlur`: the ticket and the cards, Gotowe, Szamot's bubble and the master's
  guide line draw offset shapes or a wide soft stroke; the palette is computed once per size and count.
* **Measured** (scripts/arcade-mobile.mjs, before → after): strings under 11 px — small phone 22 → 0, iPhone 22 → 0, large
  Android 22 → 0, on its side 23 → 0, tablet 2 → 0; under 13 px — 99, 99, 93, 94, 9, 3 → 0 on all six devices (German and
  HALO too); targets 0 → the card, Gotowe, every swatch, chip and the glazing Gotowe (finger-sized, inside the insets, no
  overlaps; the tests check the full eight-glaze, five-pattern palette at all nine checked sizes); 60 fps with the CPU
  slowed 2–4×; the game's own frame 0.66 ms on a desktop, 1.35–2.95 ms on the throttled devices (was 1.02 and 1.87–3.63).

#### Posłaniec

**Mobile first (2026-11-12, §12).** Subway Surfers is played upright with one thumb — a swipe anywhere,
nothing to press; Posłaniec now is too. Before, a UI scale of `min(w, h) / 640` floored at 0.62 drew the
game's own words at 6–9 px on every phone (136 strings under 11 px on a small phone, 104 even on a
desktop: "SŁOWO DNIA" 5.6, the stork's "LOT n %" 6.2, Klekot's bubble 8.7); the day's word and the
power-ups' timers sat in the bottom corners under the swiping thumb; the opening story covered the lesson
road while its first fence came. Now the phone is the reference (`layout(w, h, insets)`, layout.ts; `u` =
the kit's `uiScale`):

* **Upright.** The road fills the band from a thin strip of sky under the HUD to the bottom; a lane is
  0.29 of a narrow phone's width at the messenger's depth and the cast is drawn ×1.25, so he stands
  ~95 px tall, low (feet at 0.86 h), and a thumb swipes under and beside him — or on the dock's chart,
  which plays as the canvas's bottom edge. The band under the HUD holds only passive things: Klekot's
  gauge top right over the grass (a 78 px plate, under it two 13 px rows: "SKRZYDŁA / LOT 45 %", the
  horn's three fires, or the band's warm-up note), the **quest pill** top left (the day's word, 22 px
  tiles) with the power-ups' timers under it (40 px plates), and Klekot's bubble between them (14 px, at
  most four lines; its tail at his gauge, or down at him while he carries the messenger). Cards stack
  under the HUD; a block's verdict shows over the messenger's head, clear of the runner's banner.
* **The hands under a finger.** A swipe acts the moment the finger has travelled 22 px (was 30); a quick
  flick lifted sooner but past a 12 px slop within 0.3 s still counts, so a short sloppy stroke is never
  turned into a jump; a press within the slop is a tap by thirds of the safe width; one move per touch,
  each finger on its own. A soft ring answers every finger as it lands; haptics also on a power-up, a
  letter and a bump against the road's edge. Nothing needs a key: the coach marks speak of swipes on a
  phone and of keys first at a keyboard (`hint.*.keys`). Klekot keeps quiet while any coach mark shows
  (one bubble at a time under the HUD) and on the first-ever lesson road.
* **The opening story waits.** The first-ever session holds the run at the milestone (`sim.hold`, ≤ 20 s)
  while the story card shows — title 22 px, the three sentences and Isaiah 52:7 at 16 px where they fit
  (15 in German on a 360 × 366 band), the reference 13, "Stuknij, by ruszyć w drogę ›" ("Kliknij albo
  naciśnij Spację…" at a keyboard); a tap anywhere (the card is the game's one `targets()` entry), a move
  key or Enter sets off, and only then the lesson road's first fence comes with its coach mark.
* **A readable world.** `font()` floors at 11 px; every string the game draws is 13 px or more on all
  six devices; words on things down the road (a letter tile, the seal's ×2, a station's sign) are drawn
  only once readable instead of being blown up. The tally and the city card fit 360 px; the wings' coach
  mark is centred on a phone while the gauge glows.
* **On its side** the same arrangement fits a 292 px band (the road between the trees, the pill over the
  left grass, the gauge over the right); a tablet and a desktop grow it (u 1.3), and on a wide screen the
  ribbon of dawn still runs in the sky between the runner's panel and its score.
* **Measured** (six devices, 50 s): 0 strings under 11 px and 0 under 13 everywhere (German and HALO
  too); the story the one target; the game's own frame 0.95 ms on the desktop, 1.2–1.9 ms on phones at
  2–3× CPU slowdown (≤ 4.1 at 4× while seven audits ran); the smoke's input scores live (876 pts in 60 s).

#### Zacheusz

**Mobile first (2026-11-12, §12).** Super Mario Run is played upright with one thumb — a tap anywhere jumps, a hold
jumps higher, the course in a band across the middle. Zacheusz was laid out on a desktop (a UI scale of
`min(w, h) / 430` floored at 0.84 drew Mela's name at 9 px, the bubble button's label at 8, the band's "≈5 s" at 8, the
goose's dizzy "×" at 4.5) and its trick words drew at whatever size the last label had set (the kit's floaters were
handed "800 <family>" as the family, an invalid font). Now the phone is the reference (`layout(w, h, insets)`, `u` = the
kit's `uiScale`):

* **Upright.** The scale comes from the width — 9 u across, 40 px/u on a 360 px phone (Zacchaeus ≈ 40 px, 6.4 u ≈ 1.2 s
  of street ahead) — with 5.7 u above the street for the light road's lane, the roofs and a coin over his head under
  the HUD; the camera keeps his head under the level strip (14 px code + five 18 px slots, passive). Under the street a
  **ground band** (24 % of the canvas, at least 122 px) is the thumb's pad: a press anywhere jumps on touch-down, so the
  thumb never covers the run. The band also holds **Mela's lines** — a box under the street with "Mela:" in front and a
  tail up to the goat, 15 px (13 at worst) — so she never hides the light road or the roofs again, and the **bubble
  button** in its right corner: 56 px (hit 64), inside the 16 px edges, above the home indicator and the canvas's last
  rows (a touch on the signal dock plays at y = h − 1 and is always a jump).
* **The hands under a finger.** A ring answers every press where it came down; holding goes higher (the original's
  verbs unchanged: spin in the air, kick off walls, pause stones wait for a tap). The button squashes and lights its rim
  on touch-down and dims when it cannot rewind; a press on it that cannot rewind (no bubbles, in a bubble) is an ordinary
  press — a tap is never swallowed. A special denarius left behind with a bubble in hand points a coach mark at the
  button, once a session, until it has been used. A bubble starting buzzes; the other haptics stay. On a phone the
  how-to's rows are tap / hold / tap (the bubble in the corner) and its keys row is left out; on a desktop the keys row
  and the jump's coach marks name Space, ↑ and B.
* **Cards at 360 px.** The tally (title 24 px, rows 15/16, the next level 14.5, "stuknij — dalej" 13.5) and the story cards
  (world 13.5, title 23, text 15 or 14, Luke 19 at 16–13 px with its own 13 px reference) fit the small phone and are
  **tap targets** after 1.2 s (a tap anywhere goes on too); the button hides under them. Mela waits under a card.
* **A readable world.** `font()` floors at 11 px; every canvas string is at least 13 px on a phone except the band's delay
  tag over the skyline ("≈5 s", 12 px on a plate); the finish palm's height marks 13 px on plates; the dizzy eyes are
  drawn, not written. Mela trots 1.2–1.8 u behind him (her lag led away) so the whole goat stays on a 360 px screen,
  and the camera never lets the bubble's float back carry him off its edge.
* **On its side** (601 × 360 with the chart column, the HUD one 68 px row): a 61 px ground band holds Mela's line in
  one or two rows beside the button (its label left of it); the scale from the height (39 px/u, 11 u ahead). **A tablet
  and a desktop** grow the same layout; the scene is capped at 52 × `u` px/u, so a tablet shows 12 u of Jericho instead
  of an 80 px Zacchaeus in a sky of 480 px.
* **The frame budget.** No per-frame `shadowBlur`: cards drop an offset shape, the glows of stones, springs, light
  planks, light and special coins and the road's reach are a baked radial sprite stretched (`paintGlow`), the sky is a
  cached layer, Mela's line is measured once a line.
* **Measured** (scripts/arcade-mobile.mjs, before → after): strings under 11 px — small phone 24 → 0, iPhone 19 → 0, large
  Android 4 → 0, on its side 30 → 0, tablet 1 → 0, desktop 1 → 0; under 13 px — 16, 19, 38, 14, 2, 2 → 1 (the 12 px
  delay tag) on the phones, 0 on the tablet and the desktop; targets 0 → the bubble button, the tally and the story
  card (finger-sized, inside the insets, no overlaps); 60 fps with the CPU slowed 2–4× (was 34–49); the game's own frame
  0.9 ms on a desktop, 1.3–3.4 ms on the throttled phones.

#### Pasterz

**Mobile first (2026-11-12, §12).** Crowd City is played upright with one thumb — a drag anywhere steers the
leader — and so is Pasterz now; Łatek's whistle got a button of its own in the thumb zone.

* **The thumb zone, upright** (`layout.ts`, the reference a 360 × 366 band under the HUD). The 66 px the old
  simulator strip kept empty at the bottom are gone: the hill runs to the home indicator and the whole field
  is the joystick's. The camera comes closer — 14 m across an upright phone (was 15.5: a sheep ~25 px long,
  the call ring's dotted threshold and gold rim readable at 360 px) — and keeps to the hill (at most a metre
  beyond its edge; near the edge the shepherd walks off the middle instead of a dead band showing). The
  shepherd stands at 47 % of the band, so the thumb steers from below him. **Łatek's button** sits bottom
  right, 16 px in from the edge: a 60 px disc (a 64 × 84 target with its word "Gwizdnij" under it) with the
  dog on it, the whistle's 3.2 s cool-down sweeping its rim, gold when ready, a soft pulse while loose sheep
  are in his reach; it steps aside in a night (the hands rest) and while the tally shows. **Passive things
  live right under the HUD**: the ranking at the right (152 px wide; the pasture and its clock 13–13.5 px,
  the rows 13–14 px with the dye, the crown and the count; a name too long is fitted down to 12 px and cut),
  in a night the row of twelve stars across the band instead.
* **Under a finger.** The joystick shows from the touch-down — a dark base with a light rim where the thumb
  landed, the knob under it, a gold wedge toward the walk once the drag passes the 10 px slop — the base
  trails a thumb that runs past 1.4 × its rim, and it fades where the finger lifts. A short tap anywhere still
  whistles (the smoke's centre click does); on the button the press shows at once (pressed disc, 6 ms buzz)
  and the whistle goes on the lift; a thumb that slides 10 px off it steers instead; a tap too soon shakes
  the button (4 ms buzz). One finger plays.
* **Text and bubbles.** `font()` never returns under 11 px: the counts over the flocks 15 / 13 px, the rivals'
  names 13 px with a shadow and kept on the screen, the edge markers r 15 with 13–14 px counts, kept apart
  along the edge and off the ranking and the button, "Bee!" 13 px; Łatek's bubble 14.5 px, the rivals' 13 px,
  both inside the field and above the button's row. A coach mark hushes Łatek and, when it comes up over the
  top band, fades the ranking; its point stays 96 px under the HUD so its bubble clears the panel.
* **The tally card** is a sheet from the bottom: a round ends where the next block begins, so the runner's
  block banner is over the top of the room exactly while it shows (3.6 s under a ~5 s banner — on a phone its
  title and place were never seen). One column upright (14–20 px), two on a wider screen (the result left,
  the rows, the wardrobe and the next hill right); the story's lines drop first when the room is short.
* **On its side** (601 × 360 under a 68 px HUD row): the ranking top right under the row, the button bottom
  right under the right thumb, the joystick anywhere; the field 15.5 m across or the height's limit; the card
  in two columns. **A tablet and a desktop** get the same layout grown (`u` up to 1.3); keys stay shortcuts.
* **Words for the hand.** With a finger the hints say "przeciągnij palcem", "stuknij Łatka" (pointing at the
  button); a keyboard gets each one's `.keys` variant (myszą, strzałki / WASD, Spacja) and a keys row on the
  how-to card, which the runner drops on a touch screen. "Dotknij luźnych owiec" became "Wejdź w luźne owce"
  (it read as "tap the sheep" on a phone).
* **Speed.** The ring's gold glow lost its per-frame `shadowBlur` (a wide soft stroke under the rim), the
  fires' and the lost lamb's glows are a sprite baked once per colour, the floating words pop by transform.
* **`targets()`**: Łatek's button while it shows (by day, in play). The tests audit it at all nine
  `CHECK_SIZES` (by day, with bubbles, in a night, on the tally and the last card), check every string drawn
  (≥ 11 px; under 13 only a fitted name or a count), the font floor, the joystick from the touch-down and past
  the slop, the tap, the button's press-and-lift and slide-off, the coach marks' place and hush, the camera
  keeping to the hill, and the words for each hand.
* **Measured** (`scripts/arcade-mobile.mjs`, small / iPhone / large Android / on its side / tablet / desktop,
  before → after): strings under 11 px 49 / 42 / 35 / 78 / 0 / 0 → 0 on all six; under 13 px
  36 / 22 / 18 / 26 / 29 / 43 → 4 / 4 / 4 / 3 / 3 / 0 (only rivals' names fitted to the ranking, 12 px);
  targets none → Łatek's button (64 × 84 on a phone), inside the insets; the game's own frame 5.8 → 5.1 ms on
  the small phone at 4× CPU slowdown, 1.2–1.8 ms on the desktop (seven audits running at once); German on
  the small phone and on its side, and the EEG band on the iPhone, pass the same checks.

#### Anioł Stróż

**Mobile first (round 7, 2026-11-12).** Anioł Stróż was laid out on a desktop: on a phone its UI scale fell
to 0.84 — the combo's "SERIA", "Płomień", "Sen 100%" and the trace's "≈ 5 s" at 7.6–9 px — a 62 px band at
the bottom stayed empty for the simulator's old switch, nothing on screen said where to tap, and a
level-up offered three 102 px cards in a row.

* **Three thumb pads.** Along the bottom of every screen, in the thumb zone of a phone upright: ◀ the left
  side, the nearer side in the middle (the old middle third: the one-thumb aid and the smoke's centre tap),
  ▶ the right side — 60 px tall on a phone, the side pads ~123 px wide and the middle one 66 px, 8 px apart,
  16 px off the screen's edges. They are the visible part of the tap zones: a tap anywhere in a pad's
  column strikes like the pad (a desktop keeps the thirds a mouse expects; its pads are 56 px key caps
  "← A", "Spacja", "D →"). A strike lands on the press; the pad shows it at once (lighter, squashed 7 %);
  a key lights its pad too.
* **The pads tell when to strike.** A pad turns gold while a strike on its side would land
  (`sim.ready()`: the strike's own reach, the spear and Skrzydła ognia included), pulses brighter while the
  nearest Zmora's edge is in the perfect band, and greys for a whiff's 0.25 s; the middle pad lights the
  chevron of the nearer side. The how-to says so.
* **The room uses the phone.** Upright the room is zoomed to ±3.85 u with the floor right above the pads;
  the window (the band's last 40 s) and its sill sit under the HUD with the night's feather bar under
  them, and the window takes the height the room does not need (51 px of sky on a small phone, ~190 on a
  tall one) — no empty band. On its side the room spans the whole width (S 43 → 58 px/u), the window in
  its upper left corner beside the angel, the boss bar top right; a tablet zooms in to S 106.
* **Readable.** UI scale 1 on a phone (`uiScale`), a font floor of 11 px in paint.ts, 13 px for anything
  read in play: "Sen 62%" on a plate under the dream bubble, the combo's "SERIA" and ×n, "Płomień",
  "próg", the boss's name, the Fikołek's arrows; 14.5 px bubbles; the story card at 16–15 px, laid out to
  fit above the Zmory's heads — two pages on a small phone (the words, then Psalm 91:11), never under
  13 px or cut — and it waits under the block's banner and the gifts.
* **Gifts as a bottom sheet.** On a phone upright a level-up slides up three full-width cards (66 px, the
  icon beside the name and what it does) under the thumb; the first one's gold rim and bar count down to
  its pick; elsewhere a row of three. While it is up only a card answers a tap (keys still strike).
* **One thing at a time.** Toasts sit over the window on a phone, so the angel stays in sight; Pan Guzik
  and the coach marks wait while a toast or the story is up (`sim.busy`), the first Zmora's and the
  gifts' marks excepted; the middle pad and the gift sheet get marks pointing at them, and the gifts'
  mark goes when a gift is taken.
* **Words for the hand.** With a finger the coach marks and the how-to speak of the pads ("Środkowy
  przycisk: cios w stronę bliższej zmory", "Stuknij dar · za 5 s pierwszy"); with a keyboard they name
  ←/→, Space and 1–3 (`*.keys` variants, four languages); the registry's tip no longer says "arrows".
* **Fill rate.** No shadowBlur per frame (the aura's gold rim and the Płomień ring glow with wide
  translucent strokes, cards and bubbles cast offset shapes); the child's room is painted once per size
  into an offscreen canvas; wrapped paragraphs are cached.
* **Measured** (scripts/arcade-mobile.mjs, six devices): strings under 11 px 36/21/37/48/0/0 → 0 on all
  six, under 13 px 5/19/29/6/17/17 → 0 (German and HALO too); targets 0 → the three pads and the three
  gift cards, all ≥ 48 px and apart; the game's own frame 0.76 ms on a desktop (0.87 before; budget 4).

#### Zastępy

**Mobile first (2026-11-12, §12).** We Are Warriors! is held upright: the lane across the screen, the unit
buttons along the bottom under the thumb. Zastępy was laid out for a desktop and squeezed onto a phone: a UI
scale of 0.84 (the walls' "Mury 650" at 8 px, the prices at 11, key badges "1 2 3", "H", "T" on a touch
screen), 58 px kept empty under the cards for the old simulator switch, the card between battles at the top.
* **The thumb zone** (an upright phone, `layout.ts` shape `tall`): the light's row — the lantern (the band's
  gauge, 52 px), the light bar with its count and ×n, the pillar's and the trumpet's buttons (52 px, 10 apart)
  — over the unit cards, 16 px off the edges, on the bottom (over the home indicator, the last pixel free for
  the dock's touches). A card keeps 52 px across: one row while that holds (the next card's locked preview gives
  way first), else two (4 + 3 at gate 6: 77 × 54, the unit left, the price right); one row is 72–92 px tall.
  A card shows the shade it beats (a badge; orange with "×2" when that shade comes), its level in gold pips and
  its price at 15 px; a keyboard adds the digit.
* **Under the HUD, passive:** the gates' bar — the gate of light's walls with their number on the left (red when
  low, blue while a Cisza mends them, a flash when struck), the gate of ash's (or the boss's name and life while
  its gate is sealed) on the right, the chapter's five battles between them: 13 px numbers on 28 px bars. Under
  it Tymek (14 px, up to four lines) and "Nadchodzą" (13 px) with the wave's icons, which steps under his
  bubble rather than over his words.
* **The road:** ten metres or so across an upright phone, 13 at most with two rows of cards (the camera follows
  the front; a drag past 10 px pans); with room to spare (a tablet, an installed app) the road sits at four
  fifths of the band, the sea of clouds below it rather than empty sky above. The banners (the last 40 s) stand
  between the gates, so a gate in view never hides "now". The causeway is a strip painted once per size, the
  cards' units are sprites, and no glow is a shadowBlur any more (sprites, wide faint strokes).
* **Under a finger:** a card sends at the touch (a lane battler answers at once) and squashes; one not ready
  shakes and says why over itself; a thumb in the 6 px gap between two cards takes the nearer; a locked card
  shakes. The two buttons squash at the touch; not ready they shake with "Jeszcze chwila"; ready they glow and
  pulse. The pillar's button raises it at the front (auto-aim), a tap on the road where you tap.
* **Between battles:** a bottom sheet on a phone — the title and the gold, the chapter's map under its name,
  three stacked full-width offers (54–72 px: the picture, the name and the price at 15 px, the numbers before →
  after at 13 px on up to two lines), "Dalej · 5 s" 50 px at the foot. On its side two columns: the title, the
  gold, the map and "Dalej" under the left thumb, the offers stacked under the right; a desktop has three tiles.
* **On its side** (601 × 360): the road across the width (21 m in view); one strip along the bottom held in two
  hands — the cards from the left edge (58 px each at gate 6), the pillar and the trumpet under the right thumb
  — and over it a slim row with the lantern (out from under a resting thumb) and the light bar. A tablet grows
  the phone's layout (u 1.3, cards 120 px tall); a desktop shows the whole road, the row and the cards centred.
* **Words for the hand:** with a finger the coach marks and the how-to speak of tapping only ("Trąba gotowa —
  stuknij ją"; the how-to's third line is the trumpet's tap); with a keyboard they add the shortcut ("kliknij ją
  albo naciśnij T", 1–7, H), the badges show, and a story card says "Kliknij albo naciśnij Spację". The tip on
  the calibration card names no keys. Story cards fill the band's width: words at 15 px, the verse at 13–16.
* **Measured** (`scripts/arcade-mobile.mjs`; small phone / iPhone / large phone / on its side / tablet /
  desktop): strings under 11 px 79 / 69 / 12 / 65 / 0 / 0 → 0 everywhere; at 11–13 px 12 / 10 / 62 / 13 / 13 /
  15 → 3 / 3 / 3 / 3 / 0 / 0 (the lag's "≈ 5 s", a locked card's "brama 2", the verse's reference); targets:
  none → the cards, the pillar and the trumpet (the offers and "Dalej" between battles, the card under a
  story), all ≥ 44 px, inside the insets, 6 px apart; the game's frame on a desktop 1.24 → 0.82 ms. The layout
  test audits the targets at every `CHECK_SIZES` entry, every gate level (4–7 cards) and one to three offers,
  for a finger and a keyboard; a game test draws play, Tymek at length, seven cards, the sheet, a boss gate and
  both story cards at every size and checks the text floor; German passes on the small phone and on its side.

#### Firmament

**Mobile first (2026-11-12, §12).** Candy Crush and Royal Match are played upright with one thumb: the board
is the field, a swipe on a candy swaps it, the boosters wait under the thumb. Firmament was laid out on a
desktop and squeezed onto a phone (a UI scale of `min(w, h) / 700` floored at 0.62 drew the tray's digits at
6.6 px, the story card at 7.9, the goal strip's "500 / 6000" at 9.6, the telescope's words at 6.8–10.6 and the
flying points at 10 — the kit's `Floaters` got a whole font string and fell back to the canvas's default — and
gave the board 8 × 29 px of a 360 px phone). Now the phone is the reference (`layout(w, h, insets, rows, cols,
slots)`, `u` = the kit's `uiScale`: 1 on a phone, up to 1.3; `font()` never under 11 px):

* **Upright: the board as large as the band allows, the tools under the thumb.** Right under the HUD a 40 px
  goal strip (passive: the moves in their ring, what is left to clear at 15 px, the score bar with its stars;
  a reached score keeps its points beside the tick); then the board; then, over the home indicator, the thumb
  row: Bubo, the telescope's lens (the charge ring, the threshold ring, the light trail) and the tray, slots
  of 52 px (68 on a tablet), 8 px apart, off the outer 16 px. Cells 32 px on the smallest band (360 × 366,
  29 before), 40 on an iPhone in Safari (36), 50 on a large phone, 47 — the width filled — in an installed app.
* **Under a finger.** A swipe on a body swaps it with the neighbour it points to after 10 px (a third of a
  cell, at most 18 px); while the finger is down the body lifts and leans toward the swipe. A tap selects, a
  tap on its neighbour swaps, a tap on the selected one lets it go — decided when the finger lifts, so a
  swipe from a body picked by a tap swaps (it used to let it go on the way down). A touch up to 0.4 cell off
  the board takes the nearest body; one on the sky lets go and hushes Bubo. A tool acts on the touch (+5
  moves, the shuffle) or arms (the slot sinks under the finger, an armed one glows, its use in a pill over
  it); an aimed tool shows its strike while the finger is down (the hammer's cell, the ray's whole row),
  follows the finger and strikes where it lifts — lifted off the board, nothing is spent. A buzz on a move, a
  bounce, a tool earned and used, a level won.
* **The telescope on a phone.** Its words (the lead-in, no signal, clouds, the calm sky's stars, a full tray,
  a pulsar next) rise above the lens for 2.8 s when they change; the charge's per cent stays the ring's. Its
  brass and glass are one cached sprite, the board's glass one cached layer per level, the dark clouds
  sprites; no blur in a frame (glows are wide faint strokes).
* **Cards are bottom sheets** on a phone upright (the play waits under them): the story (15 px, the passage
  at 13–19, its reference at 12), the goal card (the level at 28 px, the goal at 17), the tally, and out of
  moves with "+5 ruchów z teleskopu" and "Jeszcze raz" 50 px tall at its foot, in the thumb zone.
* **On its side** (601 × 360, the HUD one 68 px row, the chart a column): three columns — the goal card
  (the level, the moves ring and its word, the goal, the bar) and Bubo with his bubble over him on the left;
  the board as tall as the band in the middle (35 px cells, 30 before; it no longer rises under the HUD
  row); the telescope, its words in up to three lines and the tray (60 px slots, 2 × 2 or a row) under the
  right thumb. Cards sit on the board, narrow enough that the goal and Bubo's comment stay in sight (the
  story spreads wider). A desktop keeps its picture grown to 1.3: the 600 px board risen between the Mendi
  panel and the score, the tools' names over the tray, the shortcut digits on the slots (without touch only).
* **Words for the hand.** With a finger the how-to says "Przesuń" (a swipe), the coach mark about Space says
  "stuknij dwa sąsiednie ciała po kolei", and the registry's first tip no longer names Space (four
  languages); with a keyboard the keys stay shortcuts (Space plays the hint, the arrows, Enter, 1–4).
* **Measured** (`scripts/arcade-mobile.mjs`; small phone / iPhone / large phone / on its side / tablet /
  desktop): strings under 11 px 114 / 113 / 112 / 125 / 96 / 101 (one per per cent of the charge) → 0
  everywhere, German too; at 11–13 px only the verse's reference (12) and, on its side, "RUCHY" and "/ 6000"
  (12); targets: none → the tools, the card, out of moves its two buttons (52–73 px, inside the insets, no
  overlaps); the game's frame 0.70 ms on a desktop (0.82 before), 2.3 ms on the small phone at 4× slowdown.
  The layout test audits the targets at every `CHECK_SIZES` entry with three and four slots and every stage;
  another draws the story, the goal card, play with a tool armed and Bubo talking, out of moves and the tally
  at every size on a recording context and finds no string under 11 px.

## 13. Version 4: seven games of visualisation (2026-11-12)

On 2026-11-12 the founder wrote four ideas, asked for them to be built "using all the games' mechanics
and the earlier instructions for making games", and, as always, gave a free hand to make them better:

* **FIRE, FIRE, FIRE** — *"spark → candle → bonfire → ??? → a star → a mega star → Holy Spirit:
  concentration charges the successive pictures, which light up, gain energy and grow; past a
  threshold they turn into something of a higher scale; the charging goes with growing concentration."*
* **LIGHT UP (YOUR MOOD)** — *"transformations from negative to positive: loneliness into company,
  depression into joy, debts into wealth; custom pictures too; the point is to support visualisation.
  The negative picture is a mosaic of a few, a dozen or dozens of parts covering something good; truly
  negative pictures of people's negative states are destroyed piece by piece and turned into positive
  ones; light shines along the cracks of the mosaic, and the negative pieces explode at some point."*
* **TAKE POWER, WAKE UP** — *"a game reflecting the real biochemical processes in our body: a
  visualisation of overcoming illness, of strengthening healing and regeneration; map the real
  processes from medicine (white cells eating pathogens…); the mechanic is passing through
  visualisations of positive processes (homeostasis restored in every organ, the whole body scanned
  and lit up, pathogens eaten and beaten, neural connections built and the hemispheres synchronised…),
  with variants of songs like 'every little cell…' in the background; the idea is to engage
  concentration in visualising and setting off the mind's self-healing and growth. Plan it sensibly as
  separate games."*
* **IN THE POWERFUL NAME OF JESUS I AM …** — *"you give it your own picture of a dream and strengthen
  it step by step, by focusing on the picture; the picture is first turned into a mosaic sketch (it is
  processed before the game starts); then fragment after fragment takes colour and light; a beautiful,
  aesthetic building of the vision that lights up at the end with an aura around it. The record is
  always a unique affirmation 'Przez potężne imię Jezusa ja jestem…' (rich, happy, strong, healthy…)
  with a matching picture."*

Seven games came of it (the third idea is a series of four), in two new sections of the Games tab:

| Section (registry `kind`) | Game (id) | From the founder's idea |
|---|---|---|
| Wizualizacje (`vision`) | **Ogień, ogień, ogień** (`ogien`) | FIRE, FIRE, FIRE (§13.6) |
| | **Rozświetl** (`rozswietl`) | LIGHT UP (YOUR MOOD) (§13.7) |
| | **Ja jestem…** (`jestem`) | IN THE POWERFUL NAME OF JESUS I AM (§13.8) |
| Weź moc, obudź się (`body`) | **Odporność** (`odpornosc`) | the immune response: white cells, antibodies, T cells, healing (§13.9) |
| | **Światło ciała** (`swiatlo`) | the body scanned and lit, every organ's homeostasis (§13.10) |
| | **Synapsy** (`synapsy`) | neural connections, myelin, the two hemispheres in step (§13.11) |
| | **Odnowa** (`odnowa`) | the cell's own renewal: ATP, DNA repair, autophagy, stem cells (§13.12) |

The body series is split by what the player does, so that no two games play alike: an action game
of hunting (Odporność), a calm scan with breath (Światło ciała), a building puzzle of connections
(Synapsy), and a machine to run and repair (Odnowa). The section's header carries the series line
once: "four games about real processes in your body; visualisation and attention training, not a
treatment" (`gry.bodyNote`).

### 13.1 The picture is the strategy

Mental imagery is one of the strategies that move prefrontal fNIRS feedback (Kohl 2020 lists imagery,
mental arithmetic and recall among the strategies of successful studies; §2.7). In these seven games
the push block asks the player to **picture the game's own scene** — the warmth of the flame, what
lies under the mosaic, the white cell finding the trail, the signal crossing the bridge — so the
picture on the screen and the strategy in the head are one and the same. Each game's `signal().task`
("W głowie") is an imagery strategy tied to its scene, rotated so it never repeats twice in a row,
with one plain counting or recalling strategy in the rotation for the players who do not picture
easily (about a third of people report weak imagery).

Rest blocks are **contemplation**: the picture deepens (warmth, glow, colour, an aura) while calm
holds, and a breathing guide (in for 4, out for 6 — six breaths a minute, the slow breathing that
raises heart-rate variability) moves with the picture. Rest is never waiting: it is when the picture
becomes one's own.

Everything else of §10–§12 holds: the standard HUD, the signal dock, the block design with blind
blocks, the grace rules (nothing is lost for a bad signal), mobile first (kit/mobile.ts), four
languages, the scripture rules.

### 13.2 What the lead built for this round

* **`env.body()`** (kit/body.ts, hub.ts): the band's side readings — the **balance of the two
  prefrontal halves** (Mendi's oxygenation asymmetry, the balance trainer's own metric; HALO's Fp2 − Fp1
  engagement), 0..1 with 0.5 even and the trainer's band 0.47–0.53 (`isEven`), and **Mendi's pulse**
  (bpm, from its light sensors). Each is null while unknown or unreliable: a game shows "no reading",
  never a made-up value. Synapsy shows the halves in step; Światło ciała shows the player's own pulse
  at the heart.
* **`kit/mosaic.ts`**: Voronoi mosaics (seeds spread evenly by Lloyd relaxation, denser where a picture
  has detail), cell polygons with neighbours and shared edges, the cell under a finger, shards for a
  burst, crack lines that grow inside a cell, and the picture analysis (each cell's mean colour, an edge
  map, a pencil sketch, a dark veil) — for Rozświetl and Ja jestem.
* **`kit/images.ts`**: the player's own pictures, kept **only on this device** (IndexedDB
  `brainlink-images`, resized to 1280 px, never uploaded), with a picker for the lobby's progress card.
* **`kit/song.ts`**: background songs synthesised on the arcade audio (no files, offline): a little
  sequencer with instruments, layers that join as the signal rises (adaptive music: the song itself is
  feedback), lyrics with timing for a sing-along line on the canvas. The body games each write their
  own song (an original melody and words in four languages).
* **Scripture**: 62 new passages, each read in all four editions (§13.5 lists them per game).

### 13.3 What these games promise — and what they do not

* **The body games depict real physiology**, named and with real numbers (a source for every number
  in each game's section), at a scale a player can see: the processes are real, their speed is
  compressed and the scene is a picture. They never say or imply that playing heals, cures or
  replaces treatment; the series line says it once in the Games tab, the how-to's last tip says it in
  each game. No disease is named as a target ("beat your cancer" never appears); the pathogens are
  ordinary ones (a splinter's bacteria, a cold virus).
* **Rozświetl's dark pictures** are of moods and states — loneliness, sadness, debt, fear, exhaustion —
  drawn with dignity: never self-harm, never a wound, never a hospital horror. The game names sadness
  *smutek*, not *depresja*, and its lobby carries one plain line: the game supports the imagination
  and does not treat depression; if things are very heavy, talk to someone (pl 116 123 for adults and
  116 111 for the young, both free; de TelefonSeelsorge 0800 111 0 111 / 0800 111 0 222, free and round
  the clock; sv Självmordslinjen 90101; en Samaritans 116 123 in the UK and Ireland, 988 in the US,
  findahelpline.com elsewhere; 112 in an emergency).
* **Declarations (Ja jestem…).** §5 rules out "prosperity promises". The founder's decision of
  2026-11-12 widens it: a **declaration of identity in Christ** ("Przez potężne imię Jezusa ja jestem
  silny") is allowed, because each one stands on a verse that says it (Philippians 4:13 for strong,
  2 Corinthians 8:9 for rich, Jeremiah 33:6 for healthy…), shown with it. What stays ruled out is a
  **promise of outcomes**: the game never says the declaration will make the player rich or well, and
  the album keeps declarations, not "results".

### 13.4 Reverence for the seven

* **Ogień.** The ladder is a picture of growth, like the mustard seed. Its last rung is **Pentecost**:
  tongues of fire that come *down* on the gathered disciples (Acts 2:3) — a gift that meets the
  player's small fire, never a product of the band and never "becoming" the Spirit. The Spirit is
  shown only as fire, wind and light (the dove is Arka's symbol, §5). The pillar of fire is the LORD
  going before Israel (Exodus 13:21): shown as fire over the camp, never as a figure.
* **Ja jestem….** The title keeps its ellipsis: "Ja jestem…" is the start of the player's sentence,
  never the divine name of Exodus 3:14. Jesus is named in the declaration and in the verses, never
  shown; no cross as an object. The aura is light around the player's picture, not a halo on a person.
* **Rozświetl.** The light that breaks the mosaic is just light — no figure in it, no angel. Kintsugi's
  golden seams are a craft image of healing, not a ritual.
* **The body games.** No blood gore, no dying people. Bacteria dissolve in the phagolysosome as a soft
  fizz; an infected cell's apoptosis folds it into tidy bubbles that macrophages carry away; nothing is
  ever "killed" in words a child would flinch at. The songs are original — never the viral song's words
  or melody — and never a chant that claims power over the body.
* **Exclusive symbols.** The fire ladder and Pentecost's tongues of fire to Ogień; the dark mosaic with
  golden seams to Rozświetl; the stained-glass sketch, the aura and the declarations to Ja jestem; the
  white cells to Odporność; the scan of light to Światło ciała; the neurons and the bridge between the
  halves to Synapsy; the ATP turbine and the double helix to Odnowa.

### 13.5 The seven in one table

| | Ogień, ogień, ogień | Rozświetl | Ja jestem… | Odporność | Światło ciała | Synapsy | Odnowa |
|---|---|---|---|---|---|---|---|
| Core | charge a fire through seven scales, a "powers of ten" zoom-out at each change | light breaks a dark mosaic along its cracks; tiles burst and show the bright picture under it | a sketch in stained-glass cells (an own photo: the photo's own shape) fills with colour and light, then an aura | lead a swarm of white cells through the real stages of an immune response | a band of light scans the body; each organ's balance comes back | build a network of neurons in two halves; fire pairs together to wire them | help one stem cell renew itself and divide: three needs, each from one source |
| Push (focus) | **charge**: the ring fills faster the higher the signal; full → the next scale | **light pressure** on the aimed tile; the cracks brighten and spread; full → it bursts | **colour** pours into the chosen cell; full → it lights | **alarm**: the cytokine signal reaches further, more cells answer, engulfing speeds up | **scan**: the band brightens and moves on; a lit organ settles faster | **growth**: synapses grow and thicken, myelin speeds the signal | **energy**: the turbine turns only in focus, gold for a held focus |
| Rest (calm) | **embers → light**: the charge is banked as light; the flame breathes with the player | **gazing**: the uncovered picture warms, gold fills its seams | **glow**: lit cells shine brighter, the aura grows | **healing**: inflammation settles, collagen closes the wound | **rest**: the vagus slows the heart, breath lengthens, organs settle | **consolidation**: replay, pruning, the night clean-up of the brain | **clean-up**: calm wraps worn parts into building material |
| Hands | blow (tap), shield from wind (hold), feed the fire (drag) — one small task per scale | tap a tile to aim the light, drag across tiles | tap a cell to send the colour, drag to paint | drag the swarm, tap targets | tap an organ, drag the band | tap pairs in rhythm / drag to connect | tap the glowing damage on the DNA |
| Side reading (`env.body()`) | — | — | — | — | the player's pulse at the heart (Mendi) | the halves in step lights the bridge | — |
| Headline | iskier / sparks | odłamków / shards | części / pieces | patogenów / pathogens | pkt (builder may name it) | połączeń / connections | ATP |
| Root | 2 Tim 1:6 | Isa 60:1 | Phil 2:9-10 | Ps 103:2-3 | Mat 6:22 | Rom 12:2 | 2 Cor 4:16 |
| Closing passages | Isa 42:3, Prov 20:27, Luke 24:32, Exod 13:21, Dan 12:3, Isa 60:19, Acts 2:3, Jer 20:9, Song 8:7 | Eccl 4:9-10, Ps 30:5, 2 Kgs 4:7, Phil 4:19, Isa 41:10, Isa 58:8, Mark 4:39, Gal 5:1, Isa 40:29, Mat 5:4, Rev 21:4, Ps 34:5, Isa 61:3, Isa 43:19 | per declaration: Jer 33:6, Isa 53:5, Phil 4:13, John 15:11, 2 Cor 8:9, John 8:36, Jer 31:3, John 14:27, 2 Tim 1:7, Eph 4:24, Rom 8:37, Eph 5:8, John 1:12, Eph 1:3, Prov 2:6, Prov 18:10, 1 John 1:9, Col 3:12 | Ps 121:7-8, Isa 54:17, Prov 17:22, Exod 23:25 | Ps 139:13-14, 1 Cor 6:19-20, Prov 16:24, Prov 3:7-8, Prov 4:20-22 | Eph 4:16, Col 2:2, 1 Cor 2:16, Ps 86:11, Ps 16:7 | Ps 139:16, Ezek 37:5-6, Job 33:25, Ps 51:10, John 12:24 |

Each builder rewrites its game's section below with the full design.

### 13.6 Ogień, ogień, ogień — from a spark to the fire of Pentecost

The founder's words: *"FIRE, FIRE, FIRE (spark → candle → bonfire → ??? → a star → a mega star → Holy
Spirit) — concentration charges the successive pictures, which light up, gain energy and grow; past a
threshold they turn into something of a higher scale, and so on; the charging goes with growing
concentration."* Root: 2 Timothy 1:6, *"fan into flame the gift of God"*. Code: `src/arcade/ogien/`
(rules, content, meta, sim, talk, scenes, paint, render, layout, intro, preview, panel, audio, i18n),
tests `test/arcade-ogien.test.ts`.

**The ladder: seven worlds, each at its own scale.** Every fire is a whole scene with its own palette
and scale cues, drawn in code (a cached backdrop, live layers of light, the fire, the props):

| | Fire | The scene | Frame | The hands (< 2 s) | Its verse |
|---|---|---|---|---|---|
| 1 | **Iskra** | a spark on tinder in cupped hands, the fingers lit from inside, the night far out of focus (at dawn in the 2nd picture) | 10⁻¹ m | **blow** (tap): a breath from below, the ember brightens | Isa 42:3 |
| 2 | **Świeca** | a candle on a sill, a winter village under snow outside, a curtain the draughts lift (an oil lamp in a stone window over a desert night) | 10⁰ m | **shelter** (hold): a draught is warned 1.6 s ahead (the curtain lifts, pale streaks); a held finger cups hands round the flame | Prov 20:27 |
| 3 | **Ognisko** | a bonfire on a hilltop under the stars, people sitting round it rim-lit (a charcoal fire by a lake at dawn, a boat) | 10² m | **feed** (drag a log from the pile onto the fire; tap the pile or the fire to poke it) | Luke 24:32 |
| 4 | **Słup ognia** | the pillar of fire from the sand to the clouds over Israel's camp, tents to the horizon (under a mountain) | 10⁴ m | **light the tents** (tap a dark tent: a flame arcs from the pillar to its lamp; lamps fade in ~28 s) | Exod 13:21 |
| 5 | **Gwiazda** | a star: limb-darkened disc, granulation, corona streamers, prominences (a blue giant) | 10⁹ m | **fuse** (tap a pair of hydrogen nuclei: a flash, helium) | Dan 12:3 |
| 6 | **Megagwiazda** | a hypergiant inside the nebula it threw off: glowing gas, dark dust, expanding shells (a blue one in a two-lobed nebula) | 10¹⁵ m | **gather** (drag through the gas: wisps spiral in; a tap pulls the nearest) | Isa 60:19 |
| 7 | **Zesłanie Ducha Świętego** (en Pentecost) | dawn over the city, a house whose upper room opens to the street, the wind, tongues of fire coming **down** on the gathered; the light spills into the city as the ring fills (the crowd in the streets) | from above | **pass the fire on** (tap one who waits: the flame goes from the nearest lit one to them) | Acts 2:3 |

*The "???" is the pillar of fire (Exodus 13:21)*, kept from the lead's direction: it is the first fire no
hand lit, kilometres from the sand to the clouds over a whole people — the bridge from the earth's fires
to the sky's. *The last fire is named "Zesłanie Ducha Świętego"* (the Sending of the Holy Spirit; en
Pentecost, de Pfingsten, sv Pingst), not "Duch Święty": the founder's Holy Spirit stays in the name, and
the name says what §13.4 asks — the Spirit is *sent down*, a gift that meets the player's fire; the player's
fire never *becomes* the Spirit. For the same reason the zoom turns around there: after the hypergiant the
camera comes **down** from the sky to the house.

**Focus charges the fire (push blocks).** Each fire has a ring, its charge 0..1. Past the lead-in (5 s
Mendi, 2 s HALO) the brain adds `k(level) / ringSec` a second, with `k = 0` at the threshold (level 0.5),
rising linearly to 1 at the top: the higher the signal, the faster it fills — the founder's "with growing
concentration". `ringSec` grows up the ladder (9, 12, 15, 18, 22, 26, 30 s of full focus; ×1.2 each later
round). A passed rest leaves an **ember bed** (the next push charges ×1.15); a passed push adds 5 %. The
ring never shrinks. Everything about the fire rises continuously with the shown heat (the eased level) and
the charge: its size, brightness, light radius on the world, flicker, the spark rate (sparks fly from the
fire to the ring's tip while focus charges it), the crackle (faster and louder), the pad's filter and a
soft bell for every tenth of the ring. A bad signal freezes the brain's part at neutral: no charge, no
loss, the fire never shown low for it.

**The hands add a base.** Each task's gain is a share of a ring (blow 1.2 %, trim 1 %, poke 0.9 %, a
sheltered draught 5 %, a log 6 %, a tent 3 %, a fusion 3.2 %, a wisp 1.6 %, a passed flame 4 %), softly
capped per block (each gain × (1 − used / cap); 24 % of a ring per push, 50 % in the warm-up), so
everyone climbs and tapping never outruns focus. A centre tap and Space always do the scale's task on its
best target (the smoke contract). In rest the hands rest: a tap only ripples.

**The change (the money shot, 2.8 s).** A full ring: a flare and sparks; a warm white-out (light pouring
from the fire, never a flash; a gentle cross-fade with reduced motion); the camera pulls back ×14 —
"Powers of Ten": the new world shrinks from close up while the old one is seen through a lens of light
closing on the new fire's heart, with the frame's width as a rolling power of ten ("10⁹ m", "×10⁵");
the new fire ignites with a shockwave; then its card: the scale, the name, a line, and its verse (a bottom
sheet on a phone upright, a column beside the ring elsewhere; "new in the gallery" when it is). The change
fires only in a push block or the finale: a ring that would fill in the warm-up or a rest stops short and
the rest waits as light, so the money shot always comes with focus. A full ring at Pentecost is a new
round: the camera dives into one flame, which becomes the next spark in new hands, in the richer picture —
never an empty end.

**Rest: light, never lost.** Past its own lead-in (4 s / 2 s) calm banks **light** (1.2 % of a ring a
second at calm 1, up to 45 %): a pale arc after the gold one, the scene's glow deepening; the flame and a
breathing circle keep a 4-in / 6-out breath ("wdech", "wydech" under the ring; a hum rises and falls with
it). At the next push the banked light pours back into the ring over its lead-in — the band's lag is
never dead time. The finale pours what is left.

**Blind blocks** (every 4th push from the 3rd session): smoke veils the ring and the heat; the fire burns
neutral; the brain's charge is kept apart and poured in when the smoke lifts (its sparks counted then, so
the headline leaks nothing).

**The signal on the fire** (§10.2): around the fire, the heat as a circle whose radius is the eased level,
the threshold as a dashed circle — past it the circle turns gold and the ring charges; the ring is the
charge. `meter()` is the heat in a sighted push past its lead-in ("Żar"), calm in rest ("Światło"), null
blind or without signal. `padLevel` follows the heat in a sighted push, null in rest and blind.

**Headline: sparks** (iskry / sparks / Funken / gnistor): charge gathered × the fire's worth (100, 140,
180, 240, 300, 380, 480 a ring; ×1.5 each later round), light counted when banked.

**The pace** (tuned by a test with an Ornstein–Uhlenbeck signal model): in 5 minutes a player without
control reaches the bonfire (the pillar with the hands busy), some control the pillar or the star, good
focus Pentecost (with busy hands the whole ladder and a new round); 10 minutes of good focus go round.

**Ignacy, the old lamplighter** (en/sv Ignatius, de Ignaz — *ignis*): sixty years a keeper of the flame,
he wonders at each scale with gentle humour ("Sixty years lighting lamps, and never a single star"), in
drawn bubbles (≤ 90 characters, one at a time, never over a telegraph, the banner, a card or a coach
mark): 31 moments × 3 lines × 4 languages (arriving at each fire, each task, a missed draught, the good
heat, the near-full ring, the light pouring back, the smoke lifting, passed blocks, a record, a round, the
end). His portrait is drawn in a few shapes (a cap, a white beard, his lantern's light on one cheek).

**Story.** The first session opens with a card in Ignacy's words and the root verse; every change shows
its fire's card and verse; a round has its own card. The summary closes with a line for the highest fire
("Twój ogień doszedł dziś do gwiazdy.") and that fire's verse; after a long burn (a 9-minute session or a
held focus of 14 s) Jer 20:9 and Song 8:7 take turns with it.

**Strategies (signal().task).** Push: two imagery strategies of the current scene each ("Zobacz słup
ognia nad obozem: od piasku po chmury."), a counting or recalling one every third push; blind: counting
and imagining the hidden flame; rest: breathing with the flame. Never the same twice running; each at
most 58 characters, so the phone panel's two lines show it whole.

**Meta.** *The night sky:* every session's highest fire becomes a star in the player's own sky, in a
place fixed by the session's number (a golden-angle spiral), as bright and as warm as the fire (a spark
a faint red star, Pentecost a radiant gold one, later rounds bigger) — the lobby's picture and the
progress card. *The gallery of fire:* 14 forms (each fire's two pictures), with how often each was reached
and its fastest change; a fire's second picture unlocks after three sessions there or in a second round;
the verses of the fires reached, in a fold. *Records:* sparks per session length, the highest fire (as a
ladder index), the fastest change out of each fire, changes, whole ladders, sparks in all.

**Sound** (kit/audio): each fire's own pad chord (warm and low on the earth, airy among the stars,
bright at Pentecost); the crackle or a star's hum; a voice for every task; the change's rising swell and
the new fire's bells; the breath's hum in rest.

**Reverence** (§13.4): no dove, no figure in the light at Pentecost — wind, fire, light; the tongues come
down from above by themselves (a gift, in every block), the player only passes the fire on; the pillar
is fire over the camp, never a figure; no verse is typed (all by id from `scripture.ts`).

**Mobile first.** Upright: the fire and its ring in the band between the HUD and the thumb zone; the
ladder of seven down the left edge (passive); Ignacy's bubble under the HUD; the scale's button (a 56 px
pill with the scene's flame and its verb) bottom right and the bonfire's pile (≥ 96 × 56 px) bottom left;
cards rise as a sheet from the bottom and are the only target while up. On its side and on a desktop the
cards sit in a column beside the ring. A drag lifts the log 48–80 px above the finger; a press shows at
once (the button presses in, the scene ripples or answers). No canvas text under 11 px (the game's own
floaters pop from three quarters of their size), the words to read at 13 px and more. The audit
(`scripts/arcade-mobile.mjs`, 2026-11-12): all six devices pass — 0 strings under 11 px; under 13 px only
the verse's reference line of a card at 11 px (the kit's floor) on the phones; 60 fps with the CPU slowed
4× on the small Android phone, the game's own update + draw 0.5–1.7 ms a frame; the play keeps 61 % of
the small phone's height, 81 % on its side. Performance: backdrops are cached per size (at most three), the
stars' discs and coronas are baked sprites turned each frame, every glow is a baked radial sprite.

### 13.7 Rozświetl — the dark mosaic and the light behind it

The founder's words: *"zamieniaj negatywne obrazki w pozytywne… negatywny obrazek jest jak taka
kilku-kilkunastu-kilkudziesięcioczęściowa mozaika, która przykrywa coś dobrego… prawdziwie negatywne
obrazki związane z negatywnymi stanami ludzi sukcesywnie niszczone… wzdłuż pęknięć mozaiki rozświetla się
światło i te negatywne elementy mozaiki wybuchają w pewnym momencie."* One rule readable in five seconds:
**your attention is light behind a dark mosaic; where it presses long enough, the dark breaks and the same
place shows in the light.** Root: Isaiah 60:1 ("Arise, shine, for your light has come").

Round 11 (2026-11-17, the founder after playing: *"Świetlik — więcej elementów mozaiki, wolniejszy rozpad.
Przejście do kolejnej gry dopiero po kliknięciu na modal końcowy."*): **more pieces** (16 → 72, the card up to 96),
**a slow break** (the cracks run across a tile, then its pieces fall away one by one), **the end card waits for a
click**, and the clarity rules (captions read twice, a "what to do now" line, glosses, the first tap drawn).

**The pictures (scenes.ts on scenekit.ts).** Eight pairs, each **one place painted twice** with the same
composition, so the light uncovers the same place transformed. All sixteen share one storybook gouache
style from one kit: a stage in units of min(w, h)/100 that composes at any aspect from 3:4 to 2:1 (the key
things within ±45 u of the centre, sky and ground fill the rest), people in seventeen poses (standing,
arms open, standing tall, walking, running, sitting hunched or at ease, curled up, clinging, slumped at a
desk, knees drawn up…) with the same body in both states (the dark look is the bright one's colours gone
grey, a cold rim light; the bright one warm, a sun rim), light (glows, rays, a street lamp's cone, windows),
weather (rain, fog, a dark cloud, lightning) and props (benches, beds, tables, red-stamped letters, a jar
of savings, a boat, chains, a clock face that reads 2:00 or 6:00 — no words in the pictures, any language
reads them), finished with paper grain and a vignette. Palettes: the night's ink and ash with a sickly
sodium lamp; the bright scenes' dawn sky, honey light, fresh greens, coral and teal clothes.

| Pair | Dark (the mosaic) | Bright (under it) | Verse |
|---|---|---|---|
| Samotność → Wspólnota | a hunched figure alone on a bench under a street lamp in the rain, dark windows | the same bench in a sunny park, a friend beside, a picnic, a child's kite, lit windows | Eccl 4:9-10 |
| Smutek → Radość | a figure curled on a bed in a grey room, a dark cloud raining indoors, curtains shut | the window open, sunlight pouring in, the figure standing with arms open, flowers | Ps 30:5 (then Mat 5:4, Rev 21:4) |
| Długi → Dostatek | one person head down at a table piled with red-stamped letters under a dim bulb, empty shelves | the family at a shared meal, a jar of savings, a folder stamped ✓, full shelves | 2 Kgs 4:7 (then Phil 4:19) |
| Lęk → Odwaga | a figure pressed to the rock on a narrow cliff ledge in fog | the same path in a clear morning, the figure standing tall at the top, a green valley | Isa 41:10 |
| Choroba → Zdrowie | a pale sleeper in bed, curtains drawn, a glass of water and a small lamp | the bed made, the curtains open, the figure walking out of the door into a garden | Isa 58:8 |
| Burza → Pokój | a small boat on a black wave under lightning, a crouched figure | the same boat on a calm sea at sunrise, the figure at ease | Mark 4:39 |
| Kajdany → Wolność | a figure chained in a stone cell, a sliver of moonlight | the door open, the chains broken on the floor, the figure walking into a field | Gal 5:1 |
| Zmęczenie → Siła | a figure slumped at a desk at two in the morning, a dead plant, a cold laptop | dawn: the plant in bloom, the clock at six, the figure running by the river outside | Isa 40:29 |

Dignity (§13.3, §13.4): moods, never wounds, self-harm or horror; faces without features (a lowered head
says enough); sadness is *smutek*; the light that breaks the mosaic is just light, no figure in it.

**The mosaic (kit/mosaic.ts).** The dark picture lies on Voronoi tiles over the bright one: **"Auto" 16 tiles in
the first session, then 20, 24, 28, 32, 40, 48, 56, 64, 72** (by the sessions saved; a session's 2nd and 3rd
picture take 4 and 8 more, at most 96). The progress card also offers a fixed **16, 24, 32, 48, 64 or 96** (a save
from before 2026-11-17 that chose 8 or 12 reads as 16; anything not offered as Auto). Until 2026-11-17 Auto was
7 → 36 and the card 8–48: the founder asked for more pieces. Seeds are denser where the bright picture has detail
(the kit's `detailWeight` over its edge map, softened), so faces and hands break into smaller pieces. A tile's
need grows with its size (area/mean)^0.6, and a picture takes **95 + 0.6·N seconds of base light** (it was
95 + 1.1·N): every session's picture takes as long as it did before the pieces doubled, or up to 10 % longer —
never less (session 1: 103 → 105 s; session 5: 113 → 114 s; from the 12th: 135 → 138 s). The frame keeps the
picture's own proportions and takes the whole band under the HUD; a phone that turns cuts the picture again for
the new frame, every new tile taking the state of the old one under it (uncovered, pressure, warmth, gold —
nothing is lost). On the small phone 96 pieces are ~34 px across: still aimable (a tap aims the tile under the
finger, or the dark tile nearest a tap on the light; a drag has its lens 58 px above the finger), the gauge ring
never under 18 px, the crack strokes thinner on small tiles.

**The light (push block, the gauge "Światło").** The light presses on the aimed tile from behind.
**Only held focus breaks a tile** (the founder, 2026-11-17: *"Rozbłysk ma się dziać tylko przy utrzymanej
koncentracji"* — the flash must happen only with sustained concentration):
* **always a little** (grace from showing up) — but only **up to 35 % of a tile's need** (`baseCap`): the cracks
  glow and grow, nothing bursts. The base light (a first-ever warm-up's ×1.6 too), a tap's **knock** (0.6 s of the
  base light at once, weaker when knocks come quicker than 1.2 s) and a rest's banked reserve all stop there; the
  first time the aimed tile reaches the cap without focus, the firefly says what breaks it ("Rysy już są. Kafel
  pęknie od światła Twojego skupienia." — it outranks the block's opening line, so it is never lost);
* **with held focus** — a sighted push past its lead-in (5 s Mendi, 2 s HALO) while the band's `focused` has held
  ≥ 1.5 s — the light presses past the cap at ×(1 + 2 · clamp((level − 0.3)/0.7)): ×1.57 at the threshold, ×3 at
  full, and its **halo** widens (radius 1 + 2·level mean tile radii) and spills 35 % of the light (falling off)
  onto the tiles inside it.
* In the world the gauge is drawn around the aimed tile: the **gold rim's radius is the light**, the
  **dotted ring is the threshold** (it turns gold above it); the whole grout network glimmers with warm
  white light in proportion (light seeping through the cracks from behind), brightest along the aimed
  tile's edges; each pressed tile glows from behind and its **cracks grow** with the pressure (the kit's
  crack lines from where the light or the knock hit, a growing share of each, two strokes: a warm wide one
  and a white-hot core).
* A full tile **breaks slowly** (break.ts; the founder: *"wolniejszy rozpad"*): its pieces (the kit's `shards`
  of the tile inside its grout, sprites of the dark tile as drawn, pooled) stay in place while **the cracks run
  across the whole tile** from where the light pressed to the border (0.42 s, a white-hot core and a warm wide
  stroke; the pressure's cracks fade), a soft light swelling behind it in the picture's own light colour; then
  **the pieces loosen one after another**, the nearest to that point first (≤ 0.17 s apart, the whole stagger
  ≤ 0.85 s), each with a small push out of the wall, falling with gravity (300 px/s² × u), spinning slowly
  (≤ 1.8 rad/s), a little smaller, fading over the last half of its 0.95–1.2 s fall into motes — **1.5–2.5 s a
  tile**, and the bright picture shows through piece by piece (the layer holds the bright piece from the burst).
  At most **220 pieces** fall at once: past that a burst gets fewer, at the cap one (the tile fading in place); and at
  most 27 are cut in one frame (a chain or a wave never pays for all its sprites at once); reduced motion: one piece
  fading in place. A deep thud, a glass shimmer that climbs with every link, then soft
  glass ticks as the pieces go; haptics; "+9". It passes light to each dark neighbour: 0.1 (+0.08 × the light
  while the band acts) of its need × its gold, less with each link (×0.7) — **under one tile's worth in all**, so
  a chain needs tiles the halo or the gold has already cracked: **focus and gazing make the chains** (links
  0.3 s apart, so the light is seen passing; counted once when they end, "Łańcuch ×4").
* **The flare (Rozbłysk)**, the firefly's ring — sustained concentration made visible: **only held focus** (≥ 1.5 s)
  fills it, in 12 s; a break in the focus drains it (1/30 a second), so scattered moments of focus never build it.
  Ready, it goes off **only in held focus**: a tap on the mosaic (Space on a keyboard), or by itself after 3 more
  seconds of held focus; without focus it waits (the ring dims and breathes slowly) and a tap gets the firefly's
  "Rozbłysk czeka na Twoje skupienie". Its wave presses the dark tiles within 2.2 mean radii × √(N/36) past 36
  tiles (so a mosaic of small pieces gets a flare covering the same share of the picture; 0.8 × the fall-off ×
  gold) and **bursts at most max(2, 12 % of the tiles)** — the nearest ones, the others crack up to 80 %, so no
  chain runs on from it. **The wave runs from its centre outward**: a tile bursts as the drawn ring reaches it,
  0.12 + 1.3·d/reach s after the release; bursts in the next 2.4 s count double.
* Without a reliable signal the light freezes at neutral: the base light only (cracks), no gauge, no loss.
* **Blind push** ("Na wyczucie", every 4th push from the 3rd session): the halo and the gauge hide, only the
  base light works; at the block's end the hidden light lands as a wave as strong as the block's share
  above the threshold ("To światło zbierało się w ukryciu").
* **Pacing, measured with the sim** (2026-11-17, round 11; focus held a share of each 16 s cycle, a tap every
  2.5 s, the card closed after 1.5 s; 6 seeds; before → now):

  | Session | Before (7 → 36 tiles) | Now (16 → 72 tiles) |
  |---|---|---|
  | 1st, 5 min, 50 % focus | 1.5 pictures, 14 tiles, 1.8 flares | 1.3 pictures, 30 tiles, 1.7 flares |
  | 4th, 5 min, 50 % | 1 picture, 20 tiles, 1.2 flares | 1 picture, 39 tiles, 1.2 flares |
  | 4th, 5 min, 70 % | 2 pictures, 33 tiles, 3.2 flares | 2 pictures, 62 tiles, 3 flares |
  | 11th, 10 min, 50 % | 2.2 pictures, 90 tiles, 3.2 flares | 2.2 pictures, 201 tiles, 3 flares |
  | 11th, 10 min, 30 % | 1 picture, 44 tiles, no flare | 1 picture, 94 tiles, no flare |
  | 11th, 10 min, 70 % | 3.3 pictures, 133 tiles, 7.3 flares | 3 pictures, 283 tiles, 7 flares |

  A picture takes as long as before (153–201 s at 50 %, now 157–200 s; 25–33 s of held focus each). Without
  focus: cracks, no burst, no score.

**Gazing (rest block, the gauge "Ciepło").** The dark tiles rest (no pressure). Past a 4 s lead-in (2 s
HALO) calm **warms** the uncovered pieces (a new piece is a little pale; 0.04 + 0.12·calm per second to its
full colour) and **lays gold** in the seams of the uncovered pieces (kintsugi: what broke is mended with
gold and becomes more beautiful), 0.035 + 0.13·calm per second, flowing tile to tile from the first piece
uncovered (and from any the player taps, which takes a quarter of a seam's gold at once). Gold reaches up to
the dark tiles' edges, and **a dark tile touching gold cracks faster** in the next push (× (1 + its share of
gilded edges)) — gazing prepares the light. A rest with nothing uncovered yet banks up to 0.18 of every
tile's need, landing at the next push. The firefly's light breathes **in for 4, out for 6** with a word
under it (wdech / wydech).

**The strategies (signal().task).** The picture is the strategy (§13.1): each pair has two imagery lines
for the light ("Zobacz stół zastawiony do wspólnego posiłku: kto przy nim siedzi?") and one for gazing
("Zobacz siebie na tej ławce: kto siedzi obok, co mówi?"), taking turns with shared ones — one counting
(subtract 7 from 100), one with letters, one recalling a day someone helped — never the same twice in a
row; own pictures get their own lines; blind blocks get a describing and a counting line.

**A picture done.** When ≤ 10 % of the tiles are left they go together, **one every 0.4 s** from the last burst
outward ("the last tiles go in a chain", slow enough to watch each break); the bright scene **blooms** in its own
light colour with rising motes (3.6 s); the firefly says the place's own line at once ("Ławka nie jest już pusta.
Ktoś usiadł obok.") — **pinned**: a telegraph or a banner does not cut it, a coach mark on screen steps aside — and
**the card comes only after the line has been read** and the last pieces have fallen (≥ 2.5 s into the bloom, at
most 11.5 s; never over the runner's banner): "Obraz przemieniony", the pair's name in the serif
("Samotność → Wspólnota"), the gold laid ("W złocie: 64%"), its verse (a pair's verses take turns on later
visits; a picture ≥ 90 % in gold gets Isaiah 61:3, "beauty for ashes"; **never cut**: on a small phone the card
grows upward until the passage fits), and at its bottom the button **„Dalej — następny obraz”** (a gold pill,
≥ 44 px; on a keyboard with an "Enter" key cap). **The card waits for the player** (the founder: *"przejście do
kolejnej gry dopiero po kliknięciu na modal końcowy"*): a tap anywhere on it, its button, Enter or Space — never
time (until 2026-11-17 it closed by itself after 6 s). For its first 1.2 s it takes no tap (a finger still
tapping the last tiles must not skip it): the button is dim, a thin line filling along it; then it lights and
breathes, brighter under a mouse. A tap beside the card only ripples. Then the next mosaic assembles from the
middle out over the dark. The card is half the frame on a wide screen, 60 % on a phone upright, 82 % on its side,
so the transformed place stays in sight above it.

**What the session does while a card waits** (the opening card too): **the blocks keep their clock** — the runner
owns the session's time, and the plan must still end with gazing and the finale — but **a card's seconds are not
play**: the light rests (nothing presses), the flare holds (no charge, no drain), a blind block's bank holds, the
pad holds still, the gauge hides and `signal()` says "free" (a blind block stays veiled), so neither the game's
judge nor the runner's dock counts them. After the card the judge also waits out the band's lead-in (5 s Mendi,
2 s HALO), since the signal still shows the time under the card. **A block more than half under a card gets no
verdict and is not counted** in "Bloki światła / wpatrzenia". When the card closes inside a block, the dock begins
the block again and the runner's banner says what to do (the firefly waits it out). The smoke contract still
advances it: its centre click lands on the card (the done card covers the frame's lower half, the opening card
all of it), and Space every third click closes it as well.

**The hands (phone first).** The tiles are the controls: **tap** a tile — the light aims at it and knocks
(a response on touch-down: a flash, a tick, a crack); **drag** — the light follows a lens drawn 58 px above
the finger (a mouse: the pointer itself), no knocks; a tap with a ready flare releases it there; while
gazing, a tap on an uncovered piece pours gold into its seams. Untouched, the light moves on to the most
cracked dark tile (neighbours first) when its tile bursts. A centre tap aims the centre tile and Space knocks
or releases the flare (the smoke contract); Enter or Space closes a card. `targets()` lists only a waiting
card's button.

**What to do now** (the clarity rule of 2026-11-17, now.ts). One short line at the frame's top — a drawn icon and
a few words — for the action the moment asks: the warm-up „Stuknij kafel — tam pada światło” („Kliknij…” with a
mouse), a push „Skup się — światło kruszy kafel”, a blind push „Na wyczucie — skup się bez wskaźnika”, a ready
flare „Rozbłysk gotowy — stuknij mozaikę” („kliknij albo Spacja”) or, out of focus, „Skup się — Rozbłysk czeka”,
gazing „Odpocznij — złoto spaja pęknięcia”, the finale „Wycisz się — sesja dobiega końca”. None under a card (its
button says what to do), in a bloom, or while the runner's banner says the block. It changes only when the action
does, and only once the new one has held 0.8 s (a flicker of focus never makes it jump); the place's title plate
sits under it when a picture begins.

**The voice: Świetlik (a firefly).** A small lamp-light presence by the frame's lower left (in the wall
beside it on a desktop), its light breathing, the flare's ring around it. Gentle, never a joke about the
dark pictures: 20 moments × 3 lines in four languages (≤ 90 characters), **each on screen long enough to read
twice — 2.5 s + 70 ms a character, never under 4.5 s** (they were 2.2–4 s), one at a time, never over a
telegraph, a banner or a card, plus each place's own line when it is transformed. Coach marks last by the same
rule and teach one thing at the moment it matters; the first session also **draws the first tap** on the aimed
tile (a fingertip and rings going out) until the player touches the mosaic. The gauge's coach mark waits for a
sighted push with time enough left to read it (the ring it explains is drawn only there). Words of the game are **glossed the first time**: „próg
— powyżej niego światło kruszy kafel”, „Rozbłysk (fala światła z trzymanego skupienia)”. The first-ever session
opens with a card ("Każdy ciemny obraz to mozaika z kawałków…", Isaiah 60:1, the button „Zaczynamy”) that waits
for the player too; the summary closes with the firefly's line.

**Own pictures (kit/images.ts).** In the progress card: an "after" photo (required) and, if the player likes,
a "before"; without one the game veils the "after" (kit `veil`, then ash and rain over it); a name; delete.
Every popular format (`IMAGE_ACCEPT`); on a desktop a photo can also be dropped on the card or pasted (Ctrl+V,
kit `imageDrop`). A photo that cannot be kept says why in the game's words: not a picture, an iPhone's HEIC
outside Safari, a format the browser cannot read, over 60 MB, no room on the device. They take turns with the
eight ("Wbudowane / Moje / Oba"); the card says they stay **only on this device**. The help line of §13.3 closes
the card, small but whole, in four languages.

**The meta.** The album of the eight (a dark name until transformed, then the bright one, how often, the
best gold; a tap makes it the next picture) and the own pairs; the **day's picture** (the same for everyone,
first each day: "Obraz dnia"); the tile count growing; records (shards, the best session, the longest chain,
flares, golden seams). Headline: **shards (odłamki)**, 3–9 a burst by its size, +1 per chain link, ×2 after
a flare (with smaller pieces a picture yields more shards: ~5 a tile on 72). Closing verse: the last picture's
(or, without one, Isaiah 60:1, 43:19, Psalm 34:5 in turn).

**Mobile first (§12).** The frame is 16 px off a phone's sides and takes the whole band (360 × 366 → a
328 × 348 picture on the small phone; 561 × 274 on its side); u = uiScale on a tablet or a desktop; the
firefly's bubble 14 px, the "now" line 14 px, cards' text 13–17 px (titles 18–28 in the serif), the button 16 px,
the breath words 13 px, numbers 21+; nothing under 11 px. Per frame: one cached layer for the mosaic (redrawn tile
by tile when one opens or warms), the grout and the gold as a few batched paths, glows as baked sprites
("lighter"), the breaking pieces as pooled sprites (≤ 220, the cracks of all breaking tiles in two batched paths);
no shadowBlur, no ctx.filter. Measured with the audit (§12.4), 2026-11-17 (round 11):

| Device | Strings < 11 px | < 13 px | Targets | Frame rate (CPU slowed) | Game's frame |
|---|---|---|---|---|---|
| small Android phone (360 × 600) | 0 | 1 (the verse reference, the kit's 11 px floor) | the card's button | 60 fps @4× | 2.38 ms |
| iPhone in Safari (390 × 664) | 0 | 1 (the verse reference, the kit's 11 px floor) | the card's button | 59 fps @2× | 1.16 ms |
| phone on its side (812 × 360) | 0 | 1 (the verse reference, the kit's 11 px floor) | the card's button | 60 fps @2× | 0.85 ms |
| desktop (1280 × 800) | 0 | 0 | the card's button | 60 fps @1× | 0.55 ms |
| laptop (1440 × 790) | 0 | 0 | the card's button | 60 fps @1× | 0.5 ms |
| Full HD monitor (1920 × 960) | 0 | 0 | the card's button | 60 fps @1× | 0.65 ms |
| 2560 × 1440 monitor | 0 | 0 | the card's button | 60 fps @1× | 0.59 ms |

And a stress run at 2560 × 1440 with 96 tiles (60 of them cracked to 97 % at once, a flare, a chain): the view's update + draw 0.9 ms a frame on average, 1.7 ms at the 95th percentile, 3.7 ms at worst, ≤ 226 pieces at once (≤ 27 cut a frame).

**Sources.** sim.ts (the session, pure), rules.ts (every number), content.ts (pairs, strategies, moments),
meta.ts (progress v1, the rotation, the album, `readPick`), talk.ts (the firefly, `readSec`), break.ts (a tile's
slow break, pure), now.ts (the "what to do now" line, pure), scenes.ts + scenekit.ts (the sixteen pictures),
render.ts + paint.ts + layout.ts (the view, the card and its button), preview.ts (lobby, card art, calibration),
panel.ts, audio.ts, i18n.ts; tests in test/arcade-rozswietl.test.ts.

### 13.8 Ja jestem… — the vision drawn, coloured and lit

The founder: *"IN THE POWERFUL NAME OF JESUS I AM … — you give it your own picture of a dream and
strengthen it step by step; the game works by focusing on the picture; the picture is first turned into a
mosaic sketch, processed before the game starts; then fragment after fragment takes colour and lights up;
a beautiful, aesthetic building of the vision that lights up at the end with an aura; the record is always
a unique affirmation 'Przez potężne imię Jezusa ja jestem…' with a matching picture."* So: **one vision a
session** — a picture in an arched stained-glass window — sketched before play, coloured cell by cell by
the player's focus, glowing with their calm, and at the end written out as the declaration with its verse.

**The declarations.** Eighteen, each a word (Polish in the speaker's form), a picture painted in code in
one style (luminous gouache: layered skies, light as additive glows, silhouettes with a warm rim, grass and
flowers in strokes) and the verse it stands on (§13.3: identity in Christ, never a promise of outcomes).
The figures are the player; Jesus is named, never shown; no dove, no butterfly, no cross (§13.4).

| id | pl (m / f) | en · de · sv | picture (its named fragments) | verse |
|---|---|---|---|---|
| kochany | kochany / kochana | loved · geliebt · älskad | two people embracing on a hill against the evening sun (Objęcie, Światło, Niebo, Ogród) | Jer 31:3 |
| zdrowy | zdrowy / zdrowa | healthy · gesund · frisk | a runner on a hill path at sunrise (Bieg o świcie, Słońce, Niebo, Wzgórza, Łąka) | Jer 33:6 |
| silny | silny / silna | strong · stark · stark | a cedar of Lebanon on a mountain ledge, snow peaks (Cedr, Szczyty, Niebo, Skała) | Phil 4:13 |
| szczesliwy | szczęśliwy / -a | happy · glücklich · lycklig | a dance in a meadow of poppies and cornflowers (Taniec, Słońce, Drzewo, Niebo, Kwiaty, Łąka) | John 15:11 |
| spokojny | spokojny / -a | at peace · in Frieden · i frid | a still lake at dawn, mist, a jetty, reeds (Słońce, Pomost, Niebo, Brzeg, Blask na wodzie, Jezioro) | John 14:27 |
| wolny | wolny / -a | free · frei · fri | a swallow leaving an open golden cage for the wide sky over the sea | John 8:36 |
| dziecko | dzieckiem Bożym | a child of God · ein Kind Gottes · ett Guds barn | a child running with a kite toward the rising sun | John 1:12 |
| bogaty | bogaty / -a | rich · reich · rik | a harvest table under an orchard, an overflowing basket | 2 Cor 8:9 |
| odwazny | odważny / -a | brave · mutig · modig | a figure on a rock facing a great wave, light breaking through | 2 Tim 1:7 |
| bezpieczny | bezpieczny / -a | safe · geborgen · trygg | a strong tower on a rock at dusk, its windows lit | Prov 18:10 |
| swiatlo | światłem | light · Licht · ljus | a city on a hill at night, its lights in the river | Eph 5:8 |
| blogoslawiony | błogosławiony / -a | blessed · gesegnet · välsignad | gentle rain from one cloud over sunlit fields | Eph 1:3 |
| wybrany | wybrany / -a | chosen · auserwählt · utvald | an open, lit doorway in an evening street | Col 3:12 |
| uzdrowiony | uzdrowiony / -a | healed · geheilt · helad | a young tree growing from an old stump after rain | Isa 53:5 |
| nowy | nowym człowiekiem | a new creation · ein neuer Mensch · en ny människa | a green shoot breaking the soil toward the sun | Eph 4:24 |
| oczyszczony | oczyszczony / -a | forgiven · frei von Schuld · förlåten | a clear stream washing white linen in the sun | 1 John 1:9 |
| madry | mądry / -a | wise · weise · vis | an open book by an oil lamp at night | Prov 2:6 |
| zwyciezca | zwycięzcą / zwyciężczynią | victorious · siegreich · segerrik | a figure, arms raised, on a summit over a sea of clouds | Rom 8:37 |

The sentence: pl "Przez potężne imię Jezusa ja jestem {word}.", en "In the powerful name of Jesus I am
{word}.", de "Im mächtigen Namen Jesu bin ich {word}.", sv "I Jesu mäktiga namn är jag {word}." Each
picture's geometry lives in `scenes.ts`, shared by its painter and by its **fragments**: the first region
whose test holds for a cell's centre names it, so "Bieg o świcie" in the game is the runner in the picture
(the subject always keeps at least the cell nearest the picture's heart).

**The unique affirmation and the choice.** By default the next session brings the next declaration not yet
in the album (the newcomer's order begins with *kochany*, then the founder's own four); once all eighteen
are in, the one received least and longest ago. The lobby's card lets the player **choose** one for the next
session, **pin** one for every session, or take an **own vision**: a photo of their dream
(kit/images.ts: resized, kept only on this device, never uploaded) and their own word (≤ 24 characters,
plain text — set with textContent and fillText, never markup; it lives in the picture's label on the device
and never goes into the saved session stats). An own word stands on Philippians 4:13. Polish asks the
speaker's form once — on the first session's card and in the lobby ("Mów do mnie: jestem silny / jestem
silna") — and keeps it in the progress; English, German and Swedish need none.

**Prepared before play** (prep.ts). The *analysis* — the picture at the window's 600 × 700 (painted, or the
photo cut to the window), its pixels, the kit's edge map, the pencil sketch (`sketch`, strength 1.45 on
warm paper) and the heart (a declaration's subject; a photo's centre of detail pulled toward the middle) —
takes ≈ 60–120 ms, so it runs in small steps: in the lobby as soon as the vision is chosen (the card says
"Przygotowuję szkic…" → "Szkic gotowy", and the lobby's hero shows that very sketch), in the calibration at
the latest (a step per frame, while the intro draws it), and at `start()` whatever is left. The *cut* — the
kit's `makeMosaic` for the session's cell count, its density 0.55 × `detailWeight` + 0.45 × a glow around
the heart (detail alone spent the cells on grass and flowers), each cell's colour (`cellColors`), the
fragments (named regions, or for a photo k-means over place and colour, 3–6, ordered from the heart) — costs
a few ms when the session knows its length. Cells whose inside share of the arch is under 35 % belong to
the frame.

**How many cells.** The window is cut into as many cells as the player can colour: the plan's pouring
seconds (push blocks, the warm-up × 1.2) × the player's **pace** (mean cells lit per pouring second,
averaged over sessions, 1/4.2 to start) × 0.95, within **24–64**. A typical player finishes near the end; a
strong one earlier (then the light pass); the windows grow finer as the player grows.

**The colour (push blocks: the gauge "Barwa").** Colour pours into one cell — its capacity 0.55 + 0.45 ×
area / mean (0.6–1.6 units) — as a **watercolour bloom** from its centre (an irregular, living edge, the
picture's own colours inside, a darker rim where the paint pools). The flow: **0.12 units/s at the base**
(grace: showing up colours about half the window), **0.12 + 0.34 × x^1.3** above it with x = (level − 0.15)
/ 0.75 — about **twice the base at the threshold, almost four times at full** — after the band's lead-in
(5 s fNIRS, 2 s EEG); a bad signal holds the base, never less. A full cell **lights**: a flash, sparkles, a
bell climbing a pentatonic ladder through the block, the glass baked in with a bevel of light, its leading
gold-touched. **Neighbours lit together merge**: the lead between two lit cells thins to a fine line of gold;
a **whole fragment** becomes **one pane** (the lead inside it fades to a thread), its name rises in the serif
("Bieg o świcie"), a chord. Every cell lit
before the end → "Cała wizja w barwie" and the **light pass**: a push now pours light into the whole window.
**The stream** from the oculus to the cell is the band made visible: its width and its drops follow the
level, gold above the threshold.

**The hands.** Untouched, the colour finds its own way: **from the picture's heart outward**, finishing the
current fragment before the next, a half-filled cell first (`autoNext`). **Tap** a cell: the colour goes
there, with a drop (0.06 units, once per 0.6 s) — a tap beside or on the light finds the nearest unlit cell,
so a centre tap always pours somewhere useful. **Drag** across the sketch: a path of up to 12 cells the
colour follows. **Space**: a drop. Switching never loses colour. In a rest a tap on the glass makes it glow
a little, and a tap on the sketch marks where the next push begins. Every touch shows a ring at once.

**The glow (rest blocks: "Blask").** No colour flows: the lit glass gathers light — (0.3 + 0.7 × calm) /
30 per second (a little even without a signal) — the aura's halo grows, everything breathes **in 4, out 6**
(the light, the rings, a soft swell of sound), and the task asks the player to **repeat the declaration
slowly in the mind** ("Powtarzaj w myślach powoli: ja jestem kochany.").

**The aura and the verdicts.** Each block is judged once at its end (`RoundJudge`, the last 15 s): a passed
push leaves a **ray** in the aura (≤ 6), a passed rest a **ring of glow** around the window (≤ 5); nothing is
ever taken away. `BlockContrast` gives the summary's focus − rest.

**The night (blind push, every 4th from the 3rd session).** The window darkens under a starry veil, the
oculus shows a night sky, the stream is a constant silver thread: the base flow shows, what focus adds is
kept — and **at dawn** it is poured, the cells lighting one by one in a warm wash ("Świt"), with the share
of the night in focus.

**The finale** (20 s in sessions from 3 min, 14 s from 2, 8 s in a short test; its moments scale with it).
What is still unlit fills with **light** from the lit cells outward (grace: the picture's colours nearly
whole, touched with gold, so the vision always ends complete and beautiful — "Brakujące części wypełniło
światło"; the score counts only the player's pieces), the
leading and the frame dissolve, the picture glows from within, the **rays** turn behind it, rings stand
round it, motes rise, and the declaration is **written letter by letter** in Fraunces — "Przez potężne imię
Jezusa / *ja jestem kochany.*" in gold — with its verse fading in under it. On a phone upright the window
rises and shrinks over the words; on a wide screen the words take the column beside it.

**The blocks.** The first session opens with Hanna's card (the root verse; in Polish the form question)
and a warm-up (30 s / 20 s / 6 s in a test) with a quick flow (0.3 units/s) that teaches the hands; then push
26 ± 4 s / rest 22 ± 3 s, ending on a rest, the finale last; `?trainingSec=40` and any length from 10 s fit.
Strategies (§13.1): the push asks first for the **picture's own scene** ("Zobacz, kto Cię obejmuje. Poczuj
ciepło tego objęcia."), and again every third push, with imagery, recall and one counting strategy between;
the night asks for imagery in the dark or counting down by sevens; the light pass for the light itself; the
rest for the declaration, the 4/6 breath, a soft forehead.

**Hanna the glazier** (her name means grace) talks in a dark bubble with her emblem of coloured glass under
the oculus (in the column on a wide screen): calm, few words, 19 moments × 3–4 lines, never under a banner,
a telegraph or the card, never a promise ("Odłóż pędzel. Niech światło samo rośnie."; "Resztę dopełni
światło. Nic nie przepada."). Her Polish lines never use a gendered past tense for the player.

**The meta.** The **album**: the eighteen as little arched windows — in pencil until received, in colour
after, ×n, the most pieces, the aura's best rays and rings — and the own visions the same way; the pace
that makes windows finer; the headline **części** (pieces lit this session; "z 36" under it; "cała wizja",
"noc"); the summary's first highlight is the declaration itself, `result().verse` its verse, then "Nowe
wyznanie w albumie: 7 z 18" or "To wyznanie po raz 3.", the record, the grace or the whole vision, the aura,
the night, and a closing line.

**The look and the sound.** A chapel wall in the dusk (plum to black, faint courses of stone, the window's
light on the floor); the window in a dark stone frame; the paper cells are frosted panes with a breath of
their future colour; the oculus — a six-lobed rose set into the arch's crown — fills from below with the
stream's colour up to the level, a dashed gold line across its middle is the threshold (two notches
outside), gold all over above it; silver with the calm in a rest. All light is baked sprites; the layers
(picture, paper, glass, glow, lead) are baked when they change, never per frame (≈ 0.3 ms a frame on a
desktop). Sound: a D-major-add-9 pad the runner brightens with focus, a soft trickle while paint flows
(silent at night), bells and chords, the breath's swells, the finale's chord and bells under the writing.

**Mobile first.** *Tall* (a phone upright): the window as large as the band allows, the oculus set into
its crown, Hanna's bubble under it; the opening card a bottom sheet with its two answers (≥ 48 px, in the
thumb zone). *Wide* (a phone on its side, a desktop): the window in the middle — where a thumb or a centre
tap finds it — and a column on its right (the declaration, the fragments, Hanna) when one fits. The window
itself is the free play area (tap, drag), so `targets()` lists only the card's answers. Texts ≥ 13 px
(bubbles 14, captions 17–21), nothing under 11. Measured (scripts/arcade-mobile.mjs, 2026-11-12): all six
devices pass — 0 strings under 11 px, one under 13 (the opening card's verse reference, the kit's 11 px
floor), the two answers ≥ 48 px in the thumb zone, 60 fps with the CPU slowed 2–4×, the game's own work
0.33–0.94 ms a frame; the play takes 61 % (small Android) to 81 % (a phone on its side) of the screen's
height; German on the small phone and on its side passes the same.

Files: `src/arcade/jestem/` — rules.ts, scenes.ts, art.ts, pictures.ts, content.ts, vision.ts, prep.ts,
meta.ts, talk.ts, sim.ts, layout.ts, paint.ts, render.ts, intro.ts, preview.ts, panel.ts, audio.ts, i18n.ts,
index.ts; tests in test/arcade-jestem.test.ts.

#### Round 11 (2026-11-17): an own picture in its own shape, "…ja …", the rest after 3–5 pieces, more pieces

The founder played the deployed game and asked: *"brakuje mi możliwości dodania własnego obrazka w formacie .jpeg,
.jpg, .png i innych popularnych … przetwarzany tak, żeby można go było wykorzystać w grze. Zmień 'in the powerful name
of Jesus I am' na 'in the powerful name of Jesus I'. Tytuł gry i domyślnych afirmacji pozostaw jak jest. Chcę żeby dla
własnych obrazków mozaika przybierała kształt zdjęcia a nie witraża. Chcę żeby faza odpoczynku następowała po 3-5
uzupełnionych kafelkach. Chcę żeby było więcej elementów mozaiki."* — and later *"żeby afirmacje mogły mieć do 100
znaków"*.

**Why the own picture was not found.** It was the fourth section of "Postępy", the lobby's last card, under a small
heading; the picker took `image/*` only, a transparent PNG turned black, an iPhone's HEIC failed in Chrome with one
generic line, nothing showed while a big photo was read — and, the real fault, a picked picture was **not chosen for
the next session** until a word was typed (the "use it" button only focused the field), so "Graj" brought the next
declaration.

**Own picture first** (panel.ts). The card opens with "Dodaj własny obraz": a primary button (the kit's picker,
`IMAGE_ACCEPT`: JPEG/JFIF, PNG, WebP, GIF, BMP, AVIF, HEIC/HEIF, TIFF, SVG), the block itself a drop zone (`imageDrop`:
a file dragged from a folder; a copied picture pasted with Ctrl/⌘ V), a busy line ("Wczytuję obraz…"), and a message
for each reason a picture cannot be kept (not a picture; an iPhone's HEIC outside Safari — "otworzy Safari; w innej
przeglądarce zapisz je jako JPG lub PNG"; a format the browser cannot read; over 60 MB; storage refused). A pick
**chooses the picture for the next session at once**; the next-vision box shows its **prepared sketch** (the real
prep pipeline: the pencil sketch in the photo's shape with the mosaic's grout, "Szkic gotowy"), and the continuation
field takes the cursor. The chooser of declarations opens with an "Własny obraz" tile. Pictures are kept, chosen
(a tap on a thumbnail), renamed (the continuation is the name) and deleted (×), only on this device.

**"…ja {continuation}".** The game's title ("Ja jestem…") and the eighteen declarations ("…ja jestem kochany.") keep
their words. An own vision's affirmation is the player's own continuation after "ja": pl „Przez potężne imię Jezusa
ja {…}.”, en "In the powerful name of Jesus I {…}.", **de „Im mächtigen Namen Jesu: Ich {…}.“, sv ”I Jesu mäktiga
namn: jag {…}.”** — German and Swedish put the verb second after an adverbial ("…Jesu bin ich…"), so the sentence
turns on a colon and the player's clause begins with its subject. Up to **100 characters**, plain text (textContent,
fillText), a live counter "37 / 100", the prefix in front of the field and the whole affirmation shown live above it;
an empty field says the own verse's words (Philippians 4:13: "wszystko mogę" / "can do all things" / "vermag alles" /
"förmår allt"); a continuation ending in . ! ? … gets no extra full stop. Saves before this round kept one word: the
progress (now `ver: 2`) marks each own picture `cont: false`, the game reads its word as "jestem {word}" / "am …" /
"bin …" / "är …" in the page's language, and the lobby rewrites the stored label once. Every place that shows the
affirmation fits 100 characters at every `CHECK_SIZES` entry in all four languages, wrapped and fitted down to the
reading floor, never cut: the finale (`layoutFinale`), the column beside the window (`fitLines`), the summary and the
album (DOM); the runner's two-line "W głowie" repeats a long one without quoting it.

**The photo's own shape.** An own picture's space is its own rectangle — its aspect held within 9:16…16:9 (the rest
cropped, centred), about the window's area (600 × 700) so a cell's capacity means the same (`photoSpace`). It hangs in
a thin gallery frame (a dark moulding, a gold fillet) instead of the stone arch; its gauge is a small ring medallion
on the frame's top-left corner (plain glass, the threshold line, the breath ring in a rest) instead of the rose in
the arch; the cells are cut over the photo (still denser where it has detail and around its heart) with **thin
grout** instead of lead; at the finale the grout dissolves and **the photo itself** comes through, whole, glowing,
with its aura. Hanna leaves out her three lines about lead for a photo; her other lines speak of "obraz", not
"okno". Declarations keep the arched window.

**Progress only from focus.** Colour flows in a push only past the band's lead-in (5 s Mendi, 2 s HALO), with a
reliable signal, while `focused`: 0.12 + 0.34·x^1.3 units/s (≈ 0.25 at the threshold, 0.46 at full); the warm-up's
quick 0.3 u/s also only while focused. A tap's drop joins only flowing colour (without focus a tap only chooses the
cell). Lead-in, rest, no signal: nothing flows, nothing is lost. A signal without focus for 10 s in a push: Hanna, once
a push, how the colour flows ("Barwa czeka na Twoją uwagę. Dopowiedz obrazowi jeden szczegół.").

**The rest after 3–5 pieces.** A push has no clock: it ends when its **k-th** cell lights. k is 3 for a session's
first push and follows the player's pace: a push under 24 s asks one more next time, one over 34 s or cut at its cap
one fewer, within 3…5. The cap is 40 s (without focus the rest still comes) and a push never runs into the finale's
room. The telegraph comes when the last cell is 60 % full (or 3.5 s before the cap); once telegraphed the push ends
within 8 s. The headline's line counts it ("2 z 4 do odpoczynku"), pips beside the "what to do now" line fill with it,
and its last cell says "Jeszcze jedna część, potem odpoczynek". The rest is whole breaths, `breathRest(BREATH_DEFAULT,
22, 12)` = 2 breaths of 4 in, 6 out = 20 s, guided by `breathAt` from the rest's start (the line "Odpocznij — wdech /
wydech", a ring breathing around the gauge, the glass's glow and the sound's swell); the headline says "oddech 1 z 2".
The last rest takes the whole breaths (at most three) that bring the session nearest its finale, and the finale takes
what is left. The night ends when what focus poured in the dark holds its k cells (or at the cap) and lights them at
dawn. Each block is judged once at its end over its last ≤ 15 s (`RoundJudge.from(env.tuning)`), `BlockContrast` as
before; warm-up and finale as before. The runner's panel counts a push's seconds up (`left` undefined) and a rest's
down.

**More pieces: 48–144.** A mean cell holds 1.23 units (capacity = 1.23 × (0.55 + 0.45·area/mean), clamped): ≈ 5 s of
threshold focus. Measured with the sim (5-minute sessions, calm rests): a push of 3 / 4 / 5 cells lasts 21.6 / 24–26.5 /
28.5–31 s at the threshold and 13.9 / 16.5 / 18.3 s at full focus; no focus → 40 s and nothing poured. The window holds
1.4 × what the player is expected to light (pace = cells per minute of push and rest, 5.3 to start, 2…14, averaged
over sessions; a version-1 save's pace starts again), within **48–144**: 48 in 3- and 5-minute sessions, ≈ 72 in 10
minutes. A 5-minute session at the threshold lights ≈ 25 of 49 (at full focus ≈ 32–36): the colour flows from the
heart outward, so the subject is the player's, and the finale's light completes the rest (the headline counts only
the player's pieces). Thinner lead as the cells grow finer.

**Clarity.** One "what to do now" line under the window where two lines fit, else a subtitle over its lower edge: a
drawn icon (a sun of focus that turns while colour flows, a breathing ring, a moon, a tap's ripple, a band without
signal) and a few words — "Skup się i wybierz część — tam popłynie barwa" (warm-up), "Skup się na obrazie — wtedy
płynie barwa", "Jeszcze jedna część, potem odpoczynek", "Odpocznij — wdech / wydech", "Noc — skup się w ciemności,
świt pokaże barwę", "Skup się — światło wlewa się w obraz", "Brak sygnału — nic nie przepada"; it changes only when the
action does. Hanna's lines, captions and coach marks stay ≥ 2.5 s + 70 ms a character (never under 4.5 s); the first
coach mark (where to tap) stays until the first touch; a new coach mark at the first push: "Skup się na obrazie. Po 3
częściach w barwie przyjdzie odpoczynek"; the threshold glossed ("Kreska to próg: nad nią płynie barwa"); captions no
longer stand on each other. The lobby's three lines are the three steps (focus → colour; after 3–5 pieces two breaths;
the hands), the how-to's last tip says the band measures attention ("nie wiarę ani wartość wyznania").

**Mobile first, and the desk.** layout.ts takes the picture's shape and space (`PicShape`): a photo's window is the
largest of its aspect the band allows (tall: centred, a wide photo leaves room under it; wide: a wide photo on a big
touch screen and every desk keep the column its room, the window then centred in the band's height); the gauge stays
on screen; the now line has room for two lines at every `CHECK_SIZES` entry and shape (tested for the arch and for
9:16, 3:4, 1:1 and 16:9 photos, with a finger and a mouse). Measured (scripts/arcade-mobile.mjs, final): small /
iPhone / side ✓ (0 strings under 11 px, only the opening card's verse reference at 11, game 1.75 / 0.70 / 0.96 ms,
the first at 4× CPU), desktop / laptop / Full HD / QHD ✓ (game 0.58 / 0.62 / 0.67 / 0.58 ms). With an own photo
added through the card's own picker (a scratchpad copy of the audit that uploads a generated PNG and waits for
"Szkic gotowy"): landscape on small / side / desktop ✓, portrait on small / iPhone / side / Full HD / QHD ✓, square on
iPhone / laptop ✓, and a 100-character affirmation on a 144-cell portrait photo on small / side / QHD ✓ (game 0.61 ms
at QHD, 1.67 ms on the small phone at 4× CPU) — the finale writes all of it in four lines on the smallest phone.

Files: `src/arcade/jestem/` (all), tests in `test/arcade-jestem.test.ts` (74).

### 13.9 Odporność — the white cells on watch

The founder's own example — "leukocytes eating pathogens" — so this is the series' **action game**: a
slice of skin like a living microscope slide (rose dermis, the skin's surface with the wound on top, a
venule with flowing red cells along the bottom), where the player leads a swarm of white cells through
the **real stages of an immune response, in their real order**, each a level of the run. Root Psalm
103:2-3; the headline counts **pathogens** cleared (patogenów / pathogens / Erreger / patogener). Code:
`src/arcade/odpornosc/` (sim.ts the rules, captions.ts the teaching words on the field, render/paint/hud/
layout the view, picture.ts the stage pictures and the finger, i18n.ts the words).

**The run: six stages, a loop per wound** (each 40–90 s; a goal, a soft cap after which the body's
other defences finish the job — never a failure, no stars; the run carries over between sessions):

| Stage | What really happens (shown) | The hands | Goal | Real time → here |
|---|---|---|---|---|
| **Alarm** | a splinter carries skin cocci in; Makro, the tissue macrophage, senses them (TLRs) and engulfs them; cytokines (IL-1β, TNF) go out as rings; where a ring reaches the venule its wall lights (selectins, the chemokine CXCL8) | drag Makro; tap a bacterium (he gulps it: a ring 1.6× as far) | 5 lit places on the wall | minutes → seconds |
| **Rekrutacja** | neutrophils tumble in the blood, are captured over the lit wall and **roll**, stop (integrins), crawl to a junction and **squeeze through** (diapedesis) into the tissue | tap a rolling cell (or drag along the vessel) to stop it; it stops by itself a little later anyway | 12 recruits (+2 a loop) | ~4 min through the lining → a second |
| **Łowy** | someone pulled the splinter out, the bacteria stayed and divide; the swarm follows the trail (chemotaxis) and engulfs: pseudopods wrap, a phagosome fizzes (the granules, the respiratory burst), the bacterium dissolves; a neutrophil eats 3–20 and is spent, falls into tidy apoptotic bubbles | drag to lead the swarm (drawn above the finger); tap a bacterium; the **Burst** and **NET** buttons | clear the wave (24, more each loop) | ~20 s an engulf, hours → a moment |
| **Przeciwciała** | a dendritic cell takes a piece and leaves for the lymph node (an inset: a B cell, plasma cells, Ys flying); antibodies (gold Ys) and complement (C3b dots) tag the bacteria gold — tagged ones are engulfed three times faster; bacteria in a slippery capsule bounce a neutrophil off until tagged | as in the hunt | clear the wave | ~2 weeks (memory: 3–4 days) → seconds |
| **Limfocyty T** | the nose's lining; a cold virus (a rhinovirus) replicates in its cells, which show violet flags (viral peptides on MHC I); a cytotoxic T cell docks (perforin, granzymes) and the cell **folds itself away** into tidy bubbles (apoptosis); a cell left alone bursts and the virions infect neighbours, unless interferon has made them antiviral; from loop 2 some cells hide their flags and only **NK cells** find them | tap an infected cell (the nearest T cell goes), drag to lead the T cells | no infected cell left | 30 s to the holes, minutes to fold → a second |
| **Gojenie** | back at the wound: Makro turns green (repair mode) and tidies the spent neutrophils (efferocytosis), fibroblasts weave collagen, capillaries sprout up from the venule, the skin's edges close over; a few stragglers hide in crevices | drag across the wound to lay collagen (only here: round 11); tap a spent cell to have it tidied | the wound closed | 4–21 days, remodelling a year → a minute |

Then the next loop: a splinter in a finger (skin cocci, rhinovirus A), a scraped knee (soil bacilli, many
in capsules; rhinovirus B), the gut wall (gut rods that swim with flagella; rhinovirus C) — and again,
harder (bigger waves, faster division, more capsules, more infected cells).

**The band.** Push blocks drive the **alarm** (0..1, 0.5 at the threshold), eased toward the focus level
in a sighted push after the lead-in (5 s Mendi, 2 s HALO): how far the cytokine signal reaches (50 → 100
units; the rings, and around Makro the reach drawn now and the threshold as a dashed gold ring tagged
"próg"), how many neutrophils answer (recruitment × 1…2.6), how fast they engulf and digest (× 1…1.9),
how far they smell bacteria, how far interferon protects in the nose, how far the growth signal finds
the stragglers while healing. A **held focus** (5 s Mendi, 3 s HALO above the threshold) fills the
**respiratory burst** (also a little per engulf in a push): ready, the button glows gold; a tap, Space,
or by itself after 6 s — for 6 s every neutrophil engulfs on contact and digests ×4, blue light. Rest
blocks are **healing** (gauge "Gojenie"): no new bacteria come and division pauses (the swarm holds
the line: a game convention), a **breathing guide** in the song's row swells and settles (in for 4, out
for 6, §13.1) while the swarm spreads out and dozes, calm settles the inflammation (the warm glow around
the wound breathes with it), the marrow refreshes the swarm (fresh neutrophils roll in), tapping spent
cells has Makro tidy them, calm prepares the repair under the surface by itself (the wound bed's first
strands show), and in the healing stage calm closes the wound and a drag across it weaves collagen. Blind pushes ("Na
wyczucie", every 4th from the 3rd session): the rings and the gauge hide, the
alarm stays at the base, and the block's share above the threshold is revealed at its end and paid as
burst charge. Without a reliable signal everything stays at the base: never a loss.
`meter()` = the alarm (push) / calm (rest); `padLevel` and the song follow `f.level` only in a sighted

**The hands** (one finger, §12): a drag leads the swarm (Makro in the alarm, the T cells in the nose)
to a point 56–84 px **above the finger**, golden-angle slots with flocking; a tap sends the nearest free
defenders to the bacterium or infected cell under the finger (generous: 15 units), or from bare
tissue to the nearest target (the smoke test's centre tap); in the vessel a tap stops the nearest
rolling cell and a drag along it stops every one it passes; in the healing stage a drag across the wound
lays collagen (round 11: no longer in a battle stage's rest — that fed an invisible repair and fought the
swarm's drag); the two round 60 px buttons (the burst, the NET) sit in the thumb zone; the **„Co się
dzieje?”** button ends the strip. Space: the burst when ready, else the defenders to the nearest target;
Enter/Space close a card; B the burst, N a NET, H „Co się dzieje?”. A **NET**: a charge every 8-combo (one
at the hunt's start; two with "Mocniejsze sieci"); the neutrophil nearest the densest cluster casts its
DNA over it — the caught bacteria stop and dissolve — and crawls on without its lobed nucleus (vital
NETosis, Yipp 2012).

**Juice and beauty.** A palette like a stained slide: rose and coral tissue that deepens toward the
vessel, pearl cells with lilac three-lobed nuclei (as Giemsa stains them) and eyes, lime, gold and teal
bacteria, gold antibodies; light from baked glow sprites (no shadowBlur, no filters); cached layers
(the air with a beam, the epidermis as cobblestones, collagen bundles, fibroblasts, bokeh, the venule's
endothelium). Every engulf: the cheeks puff, pseudopods wrap, a pop, a fizz of sparks rising from the
phagosome, a bloop whose pitch climbs with the combo (a bell every third), combo numbers, a 60–100 ms
hit-stop on a burst, a NET and a stage won, haptics on the moments that matter; reduced motion: no
shake, the burst's light softer.

**Clarity (round 11, the founder 2026-11-17: „niezbyt rozumiem co się tam dzieje. Napisy i tłumaczenia
zbyt szybko znikają… nie rozumiem mechanik gry”).**
* **Every word stays to be read twice**: `readSec(text)` = 2.5 s + 70 ms a character, never under 4.5 s
  (rules.ts) — Neo's and Makro's lines, toasts, coach marks, glosses, notes, word floaters („ślisko!”,
  „syty”; numbers like „×6” stay short juice), the lymph node's inset, a desk's hover tags. Neo's line is
  *held* (hidden, its clock stopped) under the runner's banner, a telegraph, a gloss or a coach mark not
  yet read, and cut only by a card; toasts and notes wait under a card, a coach mark or a gloss (a toast
  that waited 12 s is old news and goes unshown).
* **Cards wait for a tap** (or Enter/Space, after 0.6 s); the stage does not run under them (the blocks
  and the band go on). A **stage's card**: its number („Etap 3 z 6”, „Ciąg dalszy · …”, „Co się dzieje? ·
  …”), the name, the six dots, a **picture** (the scene in miniature, the thing to touch ringed, an
  animated finger tapping or dragging it — picture.ts) and **three lines of at most 70 characters**:
  *W ciele* (what really happens), *Ty* (what you do; a mouse clicks), *Skupienie* (what focus changes
  here). Full the first time a stage begins in a session while the player has seen it fewer than twice
  (`cardsFull`), else short (*Ty* and *Skupienie*). A new loop's place gets its own card first; the first
  session opens with the story and the root verse. The **„Co się dzieje?”** button (≥ 44 px, in
  `targets()`, its words where the strip has room, else a „?”) shows the stage's full card again any time.
* **What to do now**: one line under the strip (beside the stage's pill on a phone on its side and a
  desk) — the gesture's icon and the stage's goal with its progress: „Zapal 5 miejsc na ścianie naczynia
  · 2/5”, „Zatrzymaj 12 neutrofili · 7/12”, „Oczyść falę · 18 bakterii”, „Oczyść nos z wirusa · zakażone:
  3”, „Zamknij ranę · 45%”; „Odpocznij i oddychaj — ciało się goi” in a rest (in Gojenie with the closure);
  „Wybuch gotowy — stuknij przycisk!” in gold when the burst is ready. It changes only when the action
  changes. The thing to touch carries a thin pulsing ring: Makro in the alarm, the rolling cells, the
  infected cells of the nose, the wound and the spent cells while healing.
* **Coach marks with the gesture drawn** (captions.ts), the first time each control matters, one at a
  time: drag Makro (then tap a bacterium), tap a rolling cell, drag the swarm, the burst, the NET, tap an
  infected cell, drag across the wound, tap a spent cell; an animated finger taps or drags on the live
  thing. A gesture's coach mark stays until the gesture is done (then until read), gives way to a weightier
  one once read and to any other 4 s later, or goes after 20 s; an explanation (focus → the rings, a rest,
  a capsule, a hidden flag, a blind push) stays ≥ 9 s and a tap after reading takes it away. The bubble is
  drawn by the game (not the runner's `env.hint`, which sat above its point and covered the rolling
  cells, the nose's lining and, on a desk, the goal line): it takes the nearest place that covers neither
  the thing, nor the gesture's path, nor the buttons, nor the rows above the field, its tail on the thing.
* **Plain words**: 23 terms (makrofag, bakterie, cytokiny, komórka tuczna, selektyny, neutrofil,
  diapedeza, fagocytoza, zużyty neutrofil, wybuch tlenowy, sieć NET, komórka dendrytyczna, przeciwciała,
  dopełniacz, otoczka, wirus, chorągiewki, limfocyt T, komórka NK, interferon, apoptoza, fibroblast,
  kolagen) each get a gloss the first time their thing shows — the term in gold, plain words after it,
  a dark label with a thin line to the thing — once for a player (`glossed`, saved when shown); never
  before a coach mark has been read, set clear of its bubble (one at a time on a phone on its side).
* **Mechanics shown where they happen** (a blue note by the thing): „Trzymane skupienie ładuje Wybuch”
  by the button the first time a held focus charges it; „Seria ×8 → nowa Sieć” by the NET; „Połknięcie →
  silniejszy krąg alarmu” by Makro's first gulp; in a rest „Spokój goi ranę: +3%” (healing) or „Spokój:
  naprawa pod skórą +2%” every 6 s and „Spokój: szpik dosyła świeże krwinki” once; the first sighted push
  says by the rings „Twoje skupienie wzmacnia alarm: kręgi sięgają dalej. Złoty krąg to próg”.

**The voice and the story.** Neo, a young neutrophil (appetite, a life of less than a day: "Mam mniej
niż dobę, więc deser jem na początku"), and Makro, the veteran macrophage with bushy brows ("Siedzę w tej
skórze od lat"): 31 moments × 3 lines in four languages, ≤ 90 characters, each on screen `readSec`, one at
a time, held under a banner, a telegraph, a gloss or an unread coach mark. The summary closes with a line
and a passage (Prov 17:22 a wound closed, Exod 23:25 a loop done, Ps 121:7-8 the T cells' watch or a memory
formed, Isa 54:17 a stage won with a burst or a NET).

**The meta.** **Immune memory**: each pathogen (three bacteria, three rhinoviruses — memory works mostly
for the same type) is remembered one level deeper (0–3) when its adaptive stage is cleared; next time
its antibodies are there at once (no trip to the node, up to 75 % tagged from the start) and its
virus meets more T cells. **Wiedza**: 30 cards, one sourced number each, at most two new a stage, so the
collection spans sessions; announced by a toast, listed in the lobby with their sources. **Defenders that
join with play**: mast cells (40 pathogens: a second alarm source), NK cells (after the first T cells),
monocytes (200: a second macrophage), the marrow's reserve (350), a big appetite (520: +4), stronger nets
(750). Stars per stage and place, the longest streak, wounds healed. The lobby's card adds an
**illustrated glossary of the six stages** (each stage's picture · W ciele · Ty · Naprawdę: the real time
scale).

**The song** (`song.ts`, kit/song.ts): C major, 112 bpm — our verse (a white patrol squeezing through
the wall and following the trail), the series' refrain, a second verse (golden antibodies; calm,
breath, new skin), the refrain again; original words in four languages, never the viral song's;
the pad and a pluck always, then bass and lead, bell and kick, snare and hats as the level rises; the
sing-along line in the song row over the field's top (the breathing guide or Neo's bubble take its place);
a switch in the lobby.

**Honest by design** (§13.3, §13.4): the lobby's last line and the how-to's last tip: it visualises
real processes and trains attention, it does not heal and does not replace treatment; no disease is
named, the virus is "a cold virus"; nothing is killed in words — bacteria dissolve, a cell folds itself
away, spent cells are tidied; no blood (the wound is a rose slit plugged by a golden fibrin net).

**Sources** (every number on a card or a caption):
Summers et al. 2010 Trends Immunol 31:318 (50–100 bn neutrophils/day); Mestas & Hughes 2004 J Immunol
172:2731 (50–70 % of leukocytes); Lahoz-Beneytez et al. 2016 Blood 127:3431 (blood half-life ~19 h);
Lämmermann et al. 2013 Nature 498:371 (crawling 10–20 µm/min, macrophages 3–5; the LTB4 swarm relay
from >300 µm); Phillipson et al. 2006 J Exp Med 203:2569 (rolling ~40 µm/s) and Ley et al. 2007 Nat Rev
Immunol 7:678 (the adhesion cascade); Proebstl et al. 2012 J Exp Med 209:1219 (~4 min through the
endothelium, 15–40 min the wall); Kawai & Akira 2010 Nat Immunol 11:373 (10 human TLRs, TLR2);
Cambier et al. 2023 Cell Mol Immunol 20:217 (CXCL8); Guyton & Hall, Textbook of Medical Physiology 12th
ed. ch. 33 (3–20 bacteria a neutrophil, ~100 a macrophage); Segal 2005 Annu Rev Immunol 23:197 (engulfed
in ~20 s, granules +20 s; MPO ~5 % of the protein); Winterbourn et al. 2016 Annu Rev Biochem 85:765
(NOX2, MPO, HOCl); Brinkmann et al. 2004 Science 303:1532 and Yipp et al. 2012 Nat Med 18:1386 (NETs);
Gibson et al. 2018 Proc R Soc B 285:20180789 (E. coli 20 min in the lab, ~15 h in the wild); Hayes et
al. 2019 Front Immunol 10:598 (dendritic cells peak ~26 h); Hibi & Dosch 1986 Eur J Immunol 16:139
(>10,000 antibodies/s); Merle et al. 2015 Front Immunol 6:257 and Ricklin et al. 2010 Nat Immunol 11:785
(C3 ~1 mg/ml, C3b); Pollard & Bijker 2021 Nat Rev Immunol 21:83 (~2 weeks; memory 3–4 days); Morell et
al. 1970 J Clin Invest 49:673 (IgG half-life 21 days); Heikkinen & Järvinen 2003 Lancet 361:51
(rhinoviruses 30–50 % of colds); Lopez et al. 2013 Blood 121:2659 (perforin ~30 s, dying within 2 min);
Halle et al. 2016 Immunity 44:233 (2–16 kills a day, mice); Kärre et al. 1986 Nature 319:675 (missing
self); Qi et al. 2014 PNAS 111:13139 (≥100 million TCRs); Serhan & Savill 2005 Nat Immunol 6:1191 and
Fadok et al. 1998 J Clin Invest 101:890 (efferocytosis, TGF-β); Landén et al. 2016 Cell Mol Life Sci
73:3861 (the phases of healing; edges move within hours); Shoulders & Raines 2009 Annu Rev Biochem 78:929
(collagen 1/3 of protein, 3/4 of the skin's dry weight); Wilkinson & Hardman 2020 Open Biol 10:200223
(a scar up to 80 %); Amanna et al. 2007 N Engl J Med 357:1903 (antibody half-lives 50 to >200 years);
Cavaillon 2021 J Venom Anim Toxins 27:e20200147 and Kaufmann 2019 Front Immunol 10:684 (Metchnikoff's
rose thorns, 1882); Monteiro et al. 2015 Nat Commun 6:8055 (S. aureus ~1 µm).

**Mobile first.** Upright: the strip (six stage dots, the stage, „Co się dzieje?”) and the goal line
under the HUD, the song row over the field's top; the whole world (126 units high) in the band at one
uniform scale with the venule by the thumb, capped on tall screens (the air above the skin takes the
rest: a warm beam and bokeh); the two buttons in the bottom corners (60 px, 16 px off the edges, over the
vessel's ends). On its side and on a desk the goal line shares the strip's row (on its side the button is
only a „?”) so the world keeps its height (a neutrophil ≥ 8 px everywhere); the world (≤ 240 units wide)
is centred and the buttons sit in the side margins. Cards are a bottom sheet on an upright phone (nearly
the whole band; the picture above the lines, dropped under 64 px), centred elsewhere (the picture beside
the lines). Tests: `auditTargets` at every `CHECK_SIZES` entry in four states (the help button included),
the coach bubble inside the field under the goal line and off its thing at every size, the thumb zone, the
font floor. Measured (`scripts/arcade-mobile.mjs`, 2026-11-17): all seven devices pass — 0 strings under
11 px; under 13 px only the kit's verse reference (11 px); 60 fps everywhere (small Android at 4× CPU
slowdown); the game's own frame 0.7–1.5 ms (3.4 ms on the small Android at 4× slowdown); the play keeps
61 % (small phone) to 91 % (2560 × 1440) of the screen's height.

### 13.10 Światło ciała — the light of the body

*A body scan made a game: the calm, rest-led game of the series, rooted in Matthew 6:22 ("the eye is the
lamp of the body … your whole body will be full of light").* A serene standing figure of frosted glass on
a night of deep blue; its organs are drawn simply and clearly where they are, in warm colours that glow
when they are in balance. A **band of light** scans the figure from the crown to the soles. At each of
nine organs a **real homeostatic loop** is pushed out of its healthy range by an everyday thing, and the
body brings it back — drawn as it is (a first-order return), compressed in time, which the game says on
every panel ("typowe ciało · przyspieszone").

**The scan (the stage loop, ~2 minutes).** Nine stations, head to toe:

| Station | The loop (value, healthy range) | The everyday push | What the body does (drawn) | Hands |
|---|---|---|---|---|
| Podwzgórze | core temperature, 37 ± 0.5 °C (S1) | a hot bath 37.8 °C / a chilly morning 36.2 °C | skin vessels widen and sweat evaporates / vessels narrow and muscles shiver (S3, S4, S5, S6) | tap |
| Płuca | blood pH 7.35–7.45 (S7) | a held breath pH 7.31 / fast breathing pH 7.49 | chemoreceptors read CO₂ and set the breath (S9) | breathe out CO₂ bubbles |
| Serce | rate 60–100/min (S11) | the stairs 118 / a sudden noise 110 | the vagus brakes the SA node (S12) | tap on the beat |
| Wątroba i trzustka | fasting glucose 70–99 mg/dL, 3.9–5.5 mmol/L (S17) | a meal 138 / a long walk before breakfast 64 | insulin: the liver and muscles store glycogen / glucagon releases it (S18, S19) | tap |
| Nadnercza | cortisol against the day's curve (S20, S21) | a stressful thought | cortisol's own feedback quiets the HPA axis (S22) | tap |
| Nerki | sodium 135–145 mmol/L (S26) | a salty soup 148 / many glasses of water 132 | thirst and ADH keep water / ADH falls (S26, S27) | tap |
| Jelita | the lining's renewal (no number shown) | a busy day of digestion | stem cells in the crypts divide, new cells climb (S29) | tap |
| Skóra (the palms) | surface pH below 5, ~4.7 (S36) | washing hands in tap water pH 5.8 | the skin restores its acid mantle (S36) | tap |
| Kości | serum calcium 2.2–2.6 mmol/L (S33) | calcium in the blood dipped 2.15 | the parathyroids send PTH: bone releases calcium, kidneys keep it (S33, S34) | tap |

A value comes home along `d(s) = d₀ · (B/d₀)^(1−s)` (B = 0.8 half-ranges inside the range), `s` running
from 1 to 0 at `k₀ · (1 + 1.6 · light)` a second (k₀ = 0.07: about 14 s with no light, 5.5 s in full light),
which looks like a real first-order loop. Inside the band for 1 s the organ **settles**: it lights up — soft,
bright (within 13 s) or **golden** (within 9 s with the band gold 60 % of the time) — its lux fly off, its
**Wiedza card** opens the first time (one real number and its source), and the band moves on. After the
soles the light **sweeps back up** the whole body ("your whole body will be full of light"), a short card
gives the scan's stars (★ whole, ★★ from 4 golden, ★★★ from 7) and the next scan begins — **deeper**.

**Depths (the meta).** Organs → cells → systems. The first whole scan opens *Komórki* (each organ drawn as a
tissue of cells; the cards turn to alveoli, nephrons, villi, the SA node, glycogen…), the next one *Układy*
(the paths between organs glow: the vagus from the brainstem to the heart and the gut, the HPA axis from the
hypothalamus to the adrenals, the aorta). Within a session each later scan goes one deeper; across sessions a
scan starts at the shallowest depth that still has dark organs. The **body map** (9 organs × 3 depths, best
rating each, golden ringed) and the **27 Wiedza cards** fill over sessions; records: lux per session length,
whole scans, golden organs, the most golden in one scan, the fastest scan, breaths in rhythm. The **day's
organ** (the same for everyone) pays double.

**Focus — the band's light.** In a sighted push block past its lead-in (5 s Mendi, 2 s HALO) the light
follows `level`; the band thickens and turns from ice to gold, and the **threshold is drawn on the band
itself**: two dashed lines where its core reaches at the threshold, and a lamp at its side (a ring that fills,
its notch at half) where there is room (not on an upright phone, where the panel's column takes it). The
lit organ returns faster and the band travels on faster (× 0.6 + 1.4 · light). The gauge (`meter()`,
"Światło") is that light. No signal, the lead-in, a blind block: the light holds at its neutral base (0.45,
just under the threshold) — never lower, never a loss.

**Rest — the vagus' rest.** The band dims to violet; a **breath guide** in 4 / out 6 (six breaths a minute,
where heart-rate variability is largest: S10, S13) shows as rings that grow and settle around the chest; the
current organ keeps settling (k₀ · (0.6 + calm)), the band drifts on slowly, and every organ in balance
glows with calm and pours lux (`luxRest · (0.3 + calm) · (1 + lit/9)` a second). The heart slows: with
Mendi it is the player's **own pulse** (`env.body().heartRate`, "Twoje tętno: 66/min"; if the rest's mean is
3/min or more under the push's, Zofia says so and the summary keeps it); without a reading the figure's heart
beats a typical rhythm that calm slows, labelled "typowo ~70/min · bez pomiaru" — never presented as theirs.
A tap within 0.7 s of a turn of the breath is "with the breath" (+2 lx). Every 3 s the light gathered in rest
rises from the chest as a soft "+N lx", so rest visibly pays. The gauge in rest ("Spokój") is calm.

**The hands.** One round button in the thumb zone (= Space = a tap on the body): it helps the organ in the
light — at the heart a tap on the beat (within 24 % of a beat's period) helps twice, off the beat half; at the
lungs it breathes out a CO₂ bubble; elsewhere a gentle push home; between organs it steps the band on; in rest
it taps the breath. Each tap's effect falls with a flurry (`1 / (1 + 0.5 · fervour)`), so the light stays the
main driver. A tap on the organ's panel (its "Wiedza ›" chip says so; or Enter) opens its Wiedza card and, when the
organ has settled, stays with it a little longer; a tap on a glowing organ of the figure opens that organ's
card. A card that opens by itself (the organ's first time at a depth) keeps the band there 3.4 s instead of
1.6 s — stay and read — and gives the panel back 0.9 s after the next organ arrives.

**The voice.** Zofia, a calm and kind body-scan guide with a soft humour ("Wątroba ma tyle zadań, że nie
mówimy jej o nowych", "Nerki filtrują około 180 litrów na dobę. Ty tylko oddychaj."), three or more lines a
moment for 28 moments (one per organ), never over a telegraph, the runner's banner, a story card or a card.
**Story**: the first-ever session opens with a card (the eye is the lamp of the body; Matthew 6:22); every
whole scan has a short card with its stars and the depth that comes next.

**The song.** A lullaby at 66 bpm in C major (lullaby.ts on kit/song.ts): two verses of our own — "Światło
idzie przeze mnie cicho, / od korony aż do stóp; / każdy narząd zna swą miarę, / ciało wraca w równy krok" and
"Serce zwalnia, oddech długi…", original melody and words in four languages — around the series' refrain
(`seriesChorus`), arranged softly: a pad always, then the voice and the bass, then a bell and a lub-dub
heartbeat on the kick, then a harp of plucked arpeggios; the refrain's snare and hat stay out. Its level is
the focus in a sighted push, a fixed 0.32 in rest, 0.4 around, and held (null) in a blind block. The sung line
shows under the HUD (≥ 13 px, the sung part gold). The lobby's card switches it off (saved); without it the
runner's pad plays, its filter on the band's light.

**Headline: lux** (luksów / lux / Lux / lux) — the light gathered in the body: the band's light while it
shines (3 · (0.5 + light) a second), each settled organ 24 / 36 / 50 × the depth (1, 1.25, 1.5) × 2 for the
day's organ, a whole scan 100 × depth, rest's glow, taps in rhythm 2, a block judged well 30, a blind block's
share × 100. A 5-minute session with mid focus gathers roughly 1 000–2 500 lx.

**Blocks** follow §2: Skan 24 ± 3 s and Odpoczynek 26 ± 3 s (rest a little longer: a rest-led game), a 4 s
telegraph, each judged once at its end over its last 15 s (`RoundJudge.from(env.tuning)`, `BlockContrast` for
the summary), every 4th push blind from the 3rd session (the band turns silver; its share is revealed at the
end), a warm-up the first time (the light enters through the eyes), a calm finale. Strategies (`signal().task`)
are imagery of the scene — the warm light moving through the body, the organ in the light seen in the mind,
the place in the light felt — with one counting (heartbeats to 20: S15) and one recall (what this organ does);
rest's are the breath (4 / 6, a longer out-breath, the face and shoulders softening).

**Honesty and reverence (§13.3, §13.4).** The values are a typical healthy body's, compressed, each with its
source; the only measurement is the pulse. Nothing claims to heal; the how-to's last tip says it plainly. No
disease is named. The scan of light is this game's symbol; no figure of God, the figure is everyone's body,
its eyes closed in peace. Closing passages: the first session Psalm 139:13-14; a scan with 4+ golden organs
1 Corinthians 6:19-20; calm rests or a slowed pulse Proverbs 3:7-8; new cards Proverbs 4:20-22; the bones lit
or a whole scan Proverbs 16:24 — in turn, session by session.

**Sources** (verified on 2026-11-12; abstracts via PubMed and Europe PMC, full texts where open):
S1 Osilla EV et al., *Physiology, Temperature Regulation*, StatPearls 2023 (PMID 29939615) · S2 Mackowiak PA et
al., JAMA 1992;268:1578 (PMID 1302471) · S3 Charkoudian N, Mayo Clin Proc 2003;78:603, doi:10.4065/78.5.603 ·
S4 Baker LB, Temperature 2019;6:211, doi:10.1080/23328940.2019.1632145 · S5 Haman F, Blondin DP, Temperature
2017;4:217, doi:10.1080/23328940.2017.1328999 · S6 Morrison SF, Nakamura K, Annu Rev Physiol 2019;81:285,
doi:10.1146/annurev-physiol-020518-114546 · S7 Hopkins E et al., *Physiology, Acid Base Balance*, StatPearls
2022 (PMID 29939584) · S8 Ochs M et al., Am J Respir Crit Care Med 2004;169:120, doi:10.1164/rccm.200308-1107OC ·
S9 Brinkman JE et al., *Physiology, Respiratory Drive*, StatPearls 2023 (PMID 29494021) · S10 Russo MA et al.,
Breathe 2017;13:298, doi:10.1183/20734735.009817 · S11 Henning A, Krawiec C, *Sinus Tachycardia*, StatPearls 2023
(PMID 31985921) · S12 Hafeez Y et al., *Sinus Bradycardia*, StatPearls 2026 (PMID 29630253); Kashou AH et al.,
*Physiology, Sinoatrial Node*, StatPearls 2022 (PMID 29083608) · S13 Lehrer PM, Gevirtz R, Front Psychol
2014;5:756, doi:10.3389/fpsyg.2014.00756 · S14 Shaffer F, Ginsberg JP, Front Public Health 2017;5:258,
doi:10.3389/fpubh.2017.00258 · S15 Schandry R, Psychophysiology 1981;18:483, doi:10.1111/j.1469-8986.1981.tb02486.x ·
S16 Berthoud HR, Neuhuber WL, Auton Neurosci 2000;85:1, doi:10.1016/S1566-0702(00)00215-0 · S17 ADA, Standards of
Care in Diabetes—2025, §2 (doi:10.2337/dc25-s002) and §6 (doi:10.2337/dc25-s006) · S18 Jensen J et al., Front
Physiol 2011;2:112, doi:10.3389/fphys.2011.00112 · S19 Kamel-ElSayed SA, Mukherjee S, *Physiology, Pancreas*,
StatPearls 2023 (PMID 29083590); Venugopal SK et al., *Physiology, Glucagon*, StatPearls 2023 (PMID 30725767) ·
S20 Chourpiliadis C, Aeddula NR, *Physiology, Glucocorticoids*, StatPearls 2023 (PMID 32809732); Kaur J et al.,
*Physiology, Cortisol*, StatPearls 2025 (PMID 30855827) · S21 Stalder T et al., Psychoneuroendocrinology
2016;63:414, doi:10.1016/j.psyneuen.2015.10.010 · S22 Smith SM, Vale WW, Dialogues Clin Neurosci 2006;8:383,
doi:10.31887/DCNS.2006.8.4/ssmith · S23 Berson DM et al., Science 2002;295:1070, doi:10.1126/science.1067262 ·
S24 Kaufman DP et al., *Physiology, Glomerular Filtration Rate*, StatPearls 2023 (PMID 29763208) · S25 Bertram JF
et al., Pediatr Nephrol 2011;26:1529, doi:10.1007/s00467-011-1843-8 · S26 Rout P, Afzal M, *Hyponatremia*,
StatPearls 2026 (PMID 29262111); Sonani B, Al-Dhahir MA, *Hypernatremia*, StatPearls 2023 (PMID 28722989) ·
S27 Cuzzo B et al., *Physiology, Vasopressin*, StatPearls 2023 (PMID 30252325); Scott JH et al., *Physiology,
Aldosterone*, StatPearls 2023 (PMID 29261963) · S28 Helander HF, Fändriks L, Scand J Gastroenterol 2014;49:681,
doi:10.3109/00365521.2014.898326 · S29 Darwich AS et al., Drug Metab Dispos 2014;42:2016, doi:10.1124/dmd.114.058404 ·
S30 Sender R et al., PLoS Biol 2016;14:e1002533, doi:10.1371/journal.pbio.1002533 · S31 Bergstresser PR, Taylor JR,
Br J Dermatol 1977, doi:10.1111/j.1365-2133.1977.tb07152.x; Iizuka H, J Dermatol Sci 1994,
doi:10.1016/0923-1811(94)90057-4 · S32 Yousef H et al., *Anatomy, Skin (Integument), Epidermis*, StatPearls 2024
(PMID 29262154) · S33 Sahota RJ et al., *Physiology, Calcium*, StatPearls 2026 (PMID 29489276) · S34 Lofrese JJ et
al., *Physiology, Parathyroid*, StatPearls 2023 (PMID 29494116) · S35 Office of the Surgeon General (US), *Bone Health
and Osteoporosis*, 2004, ch. 2 (NBK45504); Kenkre JS, Bassett JHD, Ann Clin Biochem 2018;55:308,
doi:10.1177/0004563218759371 · S36 Lambers H et al., Int J Cosmet Sci 2006;28:359, doi:10.1111/j.1467-2494.2006.00344.x.

**Mobile first (§12).** One layout in three shapes (layout.ts, pure, tested at every `CHECK_SIZES` entry):
*tall* — any upright screen, a phone the reference: the sing-along line under the HUD, the standing figure in
the left column as tall as the band allows (330 px on the smallest phone, 820 px on a tablet), the organ's
panel (or its card) in the right column at the band's height (148–230 px × u wide), the round help button
(60 px, its hit area 72 × 88 px with the caption) in the bottom-right thumb zone, out of the 16 px edge band;
Zofia's bubble over the figure's column at the end away from the band. *side* — a phone on its side: the
panel left, the figure in the middle, the bubble and the button right. *wide* — a desktop or a tablet on its
side: the side layout grown (u ≤ 1.3), the figure capped so both columns keep 250 px × u. The band's lamp is
drawn on the side away from the panel and only where it fits (never on an upright phone, where the dashed
threshold lines on the band and its gold carry the gauge). `targets()`: the button, the panel as drawn, the
story card while it is up (then the only one). Text: what the player reads to play is 13 px and more (the
panel's lines, the push, the range, the bubble 14, the button's caption 13, the cards 14), the sources and
the "typical body" note 12, a verse's reference 11 — never under 11. No shadowBlur and no filters per frame:
the figure and every organ's lit sprite are baked per size and depth; glows are baked sprites drawn additively.

### 13.11 Synapsy — the mind renewed

**The building puzzle of the series** (Romans 12:2, "transformed by the renewing of your mind"). The
founder asked for "building neural connections in the brain and synchronising the hemispheres", and for
the processes to be "as real as medicine can map them". Synapsy is a brain seen from above — the front at
the top, where the headband sits — in which the player wires neurons into paths for thoughts, an
oligodendrocyte wraps them in myelin, and rest consolidates what was learned. Every process on screen is
real and sourced (the table at the end of this section); its speed is compressed, and the game says so.

**The brain** (`brain.ts`). One egg split by the longitudinal fissure: two hemispheres of 19 neurons each,
a hand-made template jittered a little by each player's own seed (chosen at the first session, the same
ever after, so saved links keep their neurons; neighbours never closer than 0.235 units). The anatomy is
honest in a cartoon way: vision at the back (the left occipital lobe sees the right half of the view),
hearing at the temporal sides, the motor strips across the middle (the left hemisphere moves the right
hand), Broca's area for the voice in the left frontal lobe (speech is left-lateralised in ~96 % of strong
right-handers), the hippocampi deep and near the midline (memory, drawn as a seahorse), the prefrontal
cortex in front, and the **corpus callosum** along the midline with two lanes (front and back) — the only
links between the halves. A neuron reaches neighbours within 0.5 units (~42 mm of a 167 mm brain), keeps
at most five links, and no input wires straight to an output (a thought always passes a relay). The
central sulcus and the lateral fissure are drawn among the gyri.

**The hands** (one thumb, §12).

* **Tap two neurons one after the other** — they fire together and wire: a link sprouts from the first
  toward the second (a growth cone runs across) and brings its first synapse; **tap the pair again** and
  it grows toward the next synapse (up to six). A tap **between** two neurons wires them too; tapping one
  neuron twice wires it with its best partner.
* **Drag across several neurons** — the path follows the finger (its tip rides up to 46 px above a
  fingertip), and each neuron the tip passes wires to the one before: a whole path in one stroke.
* **Oli's button** (bottom right, the thumb zone): a tap sends Oli with myelin to the barest axon of the
  lesson's path (she goes on along it); **dragged onto an axon**, she wraps that one.
* A pair fired **on the song's beat** grows ×1.5 ("w rytmie!" — the spike-timing window, playfully).
  Nothing is lost to a mistap; a near miss (a neuron just out of reach) says "too far — through a
  neighbour", a tap across the brain just starts a new chain. With a keyboard: Space wires the pair the
  lesson needs next (or sends a thought when the path is whole), O sends Oli. After six idle seconds (and
  always in the first session), or after a tap where nothing can wire, the next pair the lesson needs shows
  as a faint dotted line.

**Thoughts and lessons.** The lesson's input fires on every second beat of the song (every fourth in rest);
its pulse takes the **fastest path** the grown network offers (by real conduction time) to the output,
through the hippocampus when the lesson asks; without a whole path it runs as far as the network goes and
fades. Each synapse passes a thought with a chance — 1 − 0.5ⁿ for n synapses (transmission is
probabilistic; more synapses, a surer path) — and a thought that passes **strengthens** the link (use builds
the path, Hebb). The bridge passes 94 % (all of them in step). Learned paths keep "habit" thoughts running in
later lessons and sessions. A lesson is learned when its thoughts arrive (5–6, two more each round of the
ladder) — a gold sweep runs along its path; a **fast** lesson counts only thoughts under its conduction limit
(10 / 5 / 2.5 ms by round), computed from each link's length in millimetres and its speed — the reason to
myelinate.

| # | Lesson | Path | Lights |
|---|---|---|---|
| 1 | Zobacz i sięgnij | eye (left hemisphere) → right hand | vision, movement |
| 2 | Usłysz i klaśnij | ear (right) → left hand | hearing |
| 3 | Przez most | eye (right hemisphere: the left half of the view) → right hand | the bridge |
| 4 | Nazwij dźwięk | ear (left) → voice | language |
| 5 | Zapamiętaj melodię | ear (right) → hippocampus (right) → voice | memory |
| 6 | Złap! | eye → right hand under 10 ms | (myelin) |
| 7 | Klaśnij w rytm | ear (left) → left hand, across | — |
| 8 | Opowiedz, co widzisz | eye (right) → hippocampus (left) → voice | — |

From the second round the bridge's lessons (3, 7) are fast too, and every lesson asks two more thoughts.

**Myelin and Oli.** A sheath grows while Oli wraps it: 0.055 a second at base (a full sheath in ~18 s),
× (1 + 2 · level) in a sighted push, ×1.5 on an axon that carried a thought in the last 6 s
(activity-dependent myelination). Speed = 1 + 99 · myelin² m/s (1 → 100 m/s, inside the textbook's
0.5–150 m/s); the m/s shows on the axon while she works, and on myelin a pulse **hops from node to node**
(saltatory conduction). Pearl internodes appear one by one as she wraps.

**The band.**

* **Push = growth** (`meter()` = the level past the 5 s / 2 s lead-in; "Wzrost"). Every growth is
  × (1 + 2 · level); active links also grow by themselves (0.07 · level · heat a second, focus multiplied);
  a held focus fills the **BDNF bloom** (0.085 a second at full focus, nothing under 0.35): when full, every
  link of the lesson's path and every active link grows a synapse at once, sprouting links finish, gold
  bursts, a gentle shake (none with reduced motion) — the push block's peak. In the world: the frontal poles
  glow with the reading (where the band looks), and **the lens** (bottom left on a phone) shows one synapse
  up close — the presynaptic bouton with its vesicles, glutamate crossing the cleft, the dendritic spine whose
  head swells with the level (AMPA receptors appear on it), a dashed ring at the threshold's size, gold above
  it, and the bloom's charge as an arc around the lens.
* **Rest = consolidation** (`meter()` = calm; "Utrwalanie"). The brain's night: a soft blue dusk. Every
  3.0 s at calm 0 down to 1.1 s at calm 1 one of the session's paths **replays** at 7× a thought's speed
  (aqua streaks; sleep's replay is ~20× compressed) and consolidates its links (+0.22 × (0.6 + 0.8 · calm));
  a consolidated link gets a fine gold core and **is kept for the next session** — what was not
  consolidated is gone by then. A weak link (one synapse) idle 22 s, unconsolidated and off every path the
  session used, is **pruned** kindly (it fades into motes that drift home; its material refills the bloom's
  charge) — one every 3.4 s at most. The **glymphatic wash** follows a 4/6 breath (aqua waves from the
  midline outward on the out-breath) and clears the waste motes the work left (0.004 a second plus 0.0012
  per pulse in flight; washed at 0.02 + 0.08 · calm a second); a clean brain grows up to ×1.3. The lens
  breathes with the guide ("wdech" / "wydech").
* **Blind push** (every 4th from the 3rd session): the lens is veiled, growth runs at its base, the song
  holds; at the end the share above the threshold is revealed and paid at once (the path's links grow
  1.2 × share, the bloom's charge + 0.6 × share).
* **No signal**: everything runs at its base, the gauge shows nothing, nothing is lost.
* **The song's layers** follow the level in a sighted push, a gentle 0.32 in rest, 0.4 in the warm-up,
  and hold (null) in a blind block.

**The halves in step** (`env.body().balance`, `isEven`). What is real: ~200 million callosal axons join the
hemispheres, and coherent rhythms of the two halves depend on them (cutting the callosum abolished
interhemispheric synchrony in cat visual cortex). What the band measures: the balance of the **left and
right prefrontal cortex** — Mendi's oxygenation asymmetry (the balance trainer's metric), HALO's Fp2 − Fp1
engagement. The game says exactly that (the how-to's tip, the lobby's note, Oli). When the balance stays
inside the even band (0.47–0.53) for a second, the hemispheres' ripples fall into phase and the bridge glows
gold: every thought passes the bridge, crossing paths grow ×1.5, and the time in step counts toward a record
(real readings only). Outside the band the bridge rests. **Without a reading** the plate on the bridge says
"brak odczytu" and the bridge follows focus alone (lit in a sighted push above the threshold) — never a
made-up balance; Oli says so once a session. The plate sits on the callosum between its lanes: L · the even
band · R, the reading's dot, its word in up to two lines.

**The score.** The headline is the session's **connections** ("połączeń"): every synapse grown — a new
link's first, every thickening, the bloom's. The score corner's line: the lesson and its thoughts
("Lekcja 3 · 2/6"), or how far to the record when near, or "Nauczone! Za chwilę lekcja 4". Records: the best
session per length, the fastest path (ms), the longest time the halves were in step (s). The summary's stats:
lessons learned, thoughts delivered, the fastest path, the halves in step, links consolidated, pruned, BDNF
blooms, focus − rest.

**The meta loop.** The player's own brain persists: the consolidated links (strongest first, up to 90) and the
bridge's myelin are saved, so yesterday's paths are there today — in gold, carrying habit thoughts — and the
calibration scene shows them coming back. The **map of the mind** lights its regions (planning, vision,
movement, hearing, the bridge, language, memory, touch) as lessons use them, brighter with the links kept
there. **Wiedza**: twenty fact cards, each unlocked when its process is first met in play (the first link:
synapses; a thickening: Hebb and LTP; a pair on the beat: the timing window; a delivered thought: the NMDA
receptor; a bloom: BDNF; a sheath: myelin; Oli sent: oligodendrocytes; three sheaths or the third session:
white matter; a crossing: the corpus callosum; the halves in step: rhythms in step; speech learned: language;
a replay; a pruning; a consolidated link: sleep tidies up; a rest block: the wash; a clean brain:
aquaporin-4; the second session: energy; the first push: glia; "Złap!" learned: white matter learns). A card
shows once in the message strip (its number, its sentence, its source) and stays in the lobby's album. The
progress is version 1 from the start and reads the placeholder's save.

**The voice: Oli**, a young oligodendrocyte — a soft round glial cell with wavy arms that end in little
sheets of myelin, living in her button in the thumb zone and flying out to wrap. She wonders and jokes gently
("I have lots of arms, and none of them can wave"; "Ranvier would clap"), reacts to what happened (30
moments, three lines each in four languages: the first link, a strong one, a whole path, a lost thought, a
slow one, a crossing, the halves in step, no reading, a bloom, a pruning, a replay, the wash, a lesson
learned…), never over a telegraph, the runner's banner or the story card.

**Story and verses.** The first session opens with a card: about 86 billion neurons, connections that grow
when we learn, rest and sleep that set them; Romans 12:2; "Stuknij, by zacząć". Each lesson begins with a
two-line card in the message strip (what is real about its path). The summary closes in turn with Romans
12:2, Colossians 2:2 (the halves in step — "knit together"), Psalm 86:11 (a lesson learned — "teach me Your
way"), Psalm 16:7 (a calm rest that consolidated — "even at night"), 1 Corinthians 2:16 (a region of the map
lit) and Ephesians 4:16 (the network grown).

**The song: "Połączenia" ("Connections")** (`music.ts`, kit/song.ts): light synth-pop at 112 bpm in D major —
the game's own two verses (original words in four languages: "Iskra tu i iskra tam, / dwa neurony, jeden
plan; / razem błysk i razem lot — / rośnie most i rośnie splot." and "Uczę się i rośnie sieć, / każda droga
lśni jak nić; / we śnie wszystko złoży się — / jutro znowu zbudzę się.") around the series' refrain "Weź moc,
obudź się" (`seriesChorus`): verse, refrain, verse, refrain, 128 beats. Layer 0 a pad and a bright pluck
arpeggio over I–V–vi–IV; layer 1 the bass and the sung lead; layer 2 bells and a four-on-the-floor kick;
layer 3 the snare and off-beat hats. The inputs fire on its beats; the sing-along line sits at the bottom
(13.5 px serif, a gold thread for the line's progress, from `lineAt` on the game's own beat, so it shows with
the sound off too); the lobby's card has a switch that turns the song off (saved in the progress).

**Sound** (`audio.ts`) in the song's key: a neuron's pluck pitched by where it sits, a new link's chirp, a
thickening's bell climbing with its synapses, an arrival's chord with a clap (the hand) or a sung "ah" (the
voice), a lost thought's quiet sigh, myelin's whoosh, the bloom's cascade, an open fifth for the halves in
step, a replay's glissando, pruning's low pluck, the wash's swell, a lesson's fanfare; small sounds throttled.

**Reverence and honesty.** No person is drawn; the neurons are cells, the brain is anatomy. The game never
claims to heal: the how-to's last tip and the lobby say "visualisation and attention training — it does not
heal and does not replace treatment"; no disease is named. Pruning is tidying ("its material goes into
growth"), never loss. The band's halves are described exactly.

**Mobile first.** Upright (the reference): the brain fills the band under the HUD (169 px a unit on the
smallest phone: neurons ≥ 40 px apart, a finger picks the nearest within 25 px); the lens bottom-left and
Oli's 56–64 px button bottom-right in the thumb zone, the sing-along line between them; the message strip at
the top of the band and Oli's bubble are passive. On its side: the brain in the middle at the band's height,
the lens and the strip in a left column, Oli under the right thumb. Tablet and desktop grow with `uiScale` up
to 1.3. No string under 11 px (a test draws every state at every `CHECK_SIZES` entry on a recording context);
what is read to play is 13 px or more (bubbles 14, the strip 14.5/13.5, the story 15.5, the IO labels, Oli's
name and the lens's word 13); the passive marks (L/R on the plate, a card's citation, a verse's reference)
11–12. `targets()`: Oli's button, or the story card while it is up. A fuzz test plays the whole game with
random taps, drags, Oli and keys at every size, with a resize mid-play.

**Sources** (each number in a caption, a card or this section; abstracts read on PubMed unless marked):

| Fact | Number | Source |
|---|---|---|
| Neurons; non-neuronal cells | 86 billion; ~85 billion | Azevedo et al. 2009, J Comp Neurol 513:532 |
| Synapses in the neocortex | 164 × 10¹² | Tang et al. 2001, Synapse 41:258 |
| LTP discovered | 30 min – 10 h | Bliss & Lømo 1973, J Physiol 232:331 |
| Spines grow with LTP; AMPA receptors added | — | Matsuzaki et al. 2004, Nature 429:761; Malinow & Malenka 2002, Annu Rev Neurosci 25:103 |
| Spike-timing window | 20 ms | Bi & Poo 1998, J Neurosci 18:10464 |
| NMDA's magnesium block | ~1 mM Mg²⁺ | Nowak et al. 1984, Nature 307:462 |
| Release is probabilistic (a thought may not pass a weak link) | — | Branco & Staras 2009, Nat Rev Neurosci 10:373 |
| BDNF is activity-dependent; exercise | hippocampus +2 % | Park & Poo 2013, Nat Rev Neurosci 14:7; Erickson et al. 2011, PNAS 108:3017 |
| Conduction speed | 0.5–10 m/s bare, up to 150 m/s myelinated | Purves et al., Neuroscience, 2nd ed. 2001 (textbook) |
| Activity-dependent myelination; new oligodendrocytes for learning | — | Gibson et al. 2014, Science 344:1252304; McKenzie et al. 2014, Science 346:318 |
| Training changes white matter | — | Scholz et al. 2009, Nat Neurosci 12:1370 |
| Myelinated fibre length at 20 | 149 000–176 000 km | Marner et al. 2003, J Comp Neurol 462:144 |
| Corpus callosum | ~200 million axons | Aboitiz et al. 1992, Brain Res 598:143 |
| Interhemispheric synchrony via the callosum | — | Engel et al. 1991, Science 252:1177 |
| Right-hemisphere speech | 4 % of strong right-handers, 27 % of strong left-handers | Knecht et al. 2000, Brain 123:2512 |
| Replay in sleep | ~20× compressed, ~100 ms bursts | Lee & Wilson 2002, Neuron 36:1183; Wilson & McNaughton 1994, Science 265:676 |
| Ripples needed for memory | — | Girardeau et al. 2009, Nat Neurosci 12:1222; Buzsáki 2015, Hippocampus 25:1073 |
| Oscillations nested in human sleep | — | Staresina et al. 2015, Nat Neurosci 18:1679; Rasch & Born 2013, Physiol Rev 93:681 |
| Awake rest consolidates | — | Tambini et al. 2010, Neuron 65:280 |
| Pruning | 2–3× the spines in childhood, to ~30 | Petanjek et al. 2011, PNAS 108:13281; Schafer et al. 2012, Neuron 74:691 |
| Sleep downscales synapses | ~18 % | de Vivo et al. 2017, Science 355:507 |
| Glymphatic clearance in sleep | interstitial space +60 % | Xie et al. 2013, Science 342:373 |
| AQP4 carries it | ~70 % less without | Iliff et al. 2012, Sci Transl Med 4:147ra111 |
| CSF waves in human sleep | — | Fultz et al. 2019, Science 366:628 |
| The brain's energy | 2 % of weight, 20 % of energy | Raichle & Gusnard 2002, PNAS 99:10237 |
| We answer a sound faster than a sight (the card of "Usłysz i klaśnij") | — | Jain et al. 2015, Int J Appl Basic Med Res 5:124 |

**What is compressed or pictured.** A thought's pulse is slowed thousands of times so it can be seen; the
m/s and a path's milliseconds are computed from the real speeds and a 167 mm brain. Replay, pruning,
myelination and the wash happen in seconds instead of nights and weeks; tens of neurons stand for billions;
"a synapse" is the game's unit of a connection's strength.

### 13.12 Odnowa — the cell renews itself

A cell to help (2026-11-12; rebuilt for clarity in round 11, 2026-11-17). Files: `src/arcade/odnowa/` (rules,
content, meta, talk, sim, layout, paint, render, intro, preview, panel, audio, song, i18n, index), tests in
`test/arcade-odnowa.test.ts`.

**Round 11: "nie rozumiem kompletnie co robię".** The founder could not tell what to do: the first version showed at
once a turbine with pumps, three unnamed chips, a scrolling DNA lane with a gate, crew names, a streak, a full-power
charge, Wiedza toasts with sources in the middle of a push, Mito's bubble and the sing-along line — and the turbine
turned without any focus. Now the game says one goal and shows it always, each need has one source, the systems
come one at a time, and progress comes only from the real thing.

**The goal, always on screen.** Under the HUD: **„Pomóż komórce się odnowić i podzielić”** and the three needs as
labelled bars — **Energia** (from focus), **Naprawa DNA** (from the hands), **Budulec** (from rest). A phone upright
shows „Napełnij 3 paski — komórka się podzieli” over three two-line chips (the name; under it the source's sign — a
head with rays, a fingertip, a moon — the bar and the count); a phone on its side stacks one-line chips on the right;
a wide screen has a panel in the right column (the sentence, each bar with „· ze skupienia / Twoje stuknięcia /
z odpoczynku”, and the outcome row „Trzy pełne → podział: nowa komórka w Twojej tkance (n)”). A full bar turns gold
with a tick; what fills it flies into it (golden ATP from the turbine, a bead from a mended rung, building beads
from a lysosome).

**What to do now.** A persistent pill over the play (an icon and a few words): „Skup się — turbina robi energię”,
„Stuknij świecące uszkodzenie na DNA” (once a lesion has waited 1.5 s — a quick tapper never sees it), „Odpocznij —
komórka sprząta”, „Skup się na wyczucie — wynik po bloku”, „Napraw DNA — wtedy komórka się podzieli” (the checkpoint),
„Komórka się dzieli — patrz!”, „Brak sygnału — nic nie przepada”, „Koniec sesji — komórka odpoczywa”. It changes only
when the action changes: a new block, the division and the end at once, the hands' prompts after 2.5 s on screen.
A mouse reads „Kliknij …”. Mito, tapped, says the same in his words (`help.*`).

**One system at a time.** The first session: a short card (the goal, „pokażę Ci je po kolei”, 2 Corinthians 4:16;
the warm-up waits while it is read, it closes by itself after its reading time); then **energy** (the turbine and its
bar; the lane dim, the clean-up hidden, the other bars dim), then **DNA** (once the turbine has been shown 8 s and
made 6 ATP, or after 16 s), then the **clean-up** (with the first rest), then the **division** (after the rest's own
explanation, 10 s into the clean-up or when two needs are full). Each comes with a highlight and a coach mark at the
thing. A returning player sees the four in a quick stagger (0.5, 2.5, 4.5, 6.5 s). A player of the first version is
taught again once (the save's explanations are forgotten: `seen` gets the mark `r11`).

**Energy — only from focus.** The ATP synthase turns only while the band says *focused* (above the threshold, short
dips forgiven): its drive is 0.3 at the threshold and 1 at level 0.9, 1.5 turns a second at full drive, 3 ATP a turn
(8 protons, the c₈ ring); a focus held 3 s (1.5 s HALO) turns it **gold** and ×1.4 (no tap: the full power of the
first version went). Without focus — or without a signal — the rotor coasts to a stop and shivers in place; nothing
is lost. In a rest it idles cool (the rest asks for calm). The panel's gauge (`meter`, „Energia”) is the band's level,
and the ring round the lens shows the same with the threshold mark at the top. A blind push banks its ATP (the
headline and the bar hold) and pays it at the block's end („na wyczucie: +62 ATP”).

**DNA repair — from the hands.** In a push (and the warm-up) damage glows on the helix — at most two at a time, at
least 1.7 units apart, one every 4.5–7.5 s — and waits: the helix scrolls on only while it is clean. One tap sends
the real crew, which runs every step of its pathway in order, named small over the lane („ekipa naprawcza ·
glikozylaza”): base excision (glycosylase → APE1 → polymerase β → ligase; an abasic site starts at APE1),
nucleotide excision for UV dimers and bulky adducts (XPC → TFIIH → XPF + XPG → polymerase → ligase), end joining for
a double-strand break (Ku → ligase IV; rare, from the second stage, slower). A tap on the lane goes to the nearest
damage, anywhere else (or Space) to the one waiting longest. Each repair fills the DNA bar; once it is full no new
damage comes („DNA sprawdzone ✓”). In a rest no damage comes, and the cell's own crew mends what waits — as fast as
the calm allows. The **checkpoint**: all three full but damage open → no division until it is mended.

**Building material — from rest.** In a rest worn parts appear in the clean-up's column (a worn mitochondrion, a
protein clump, an old peroxisome), are tagged (ubiquitin; PINK1 and Parkin), wrapped by the phagophore **only with
calm** (rate 0.3 × calm a second; no calm, no wrapping — and nothing lost: a part half-wrapped waits for the next
rest), sealed, carried to a lysosome, fused and digested into 2–3 material. No tap, no drag: rest is rest. A calm
rest (judged at its end) adds 2. The breath guide (kit/breath, 4 in · 6 out) rings the lysosomes and the lens
counts „wdech · 4”; rests are whole breaths (two or three, 20 or 30 s).

**The division.** All three full and no damage open → mitosis in the lens, in plain words with the term after
(„chromosomy gęstnieją (profaza)”, „stają w szeregu (metafaza)”, „rozchodzą się (anafaza)”, „z jednej robią się
dwie (telofaza)”); one daughter stays a stem cell, the other joins the tissue („Nowa komórka! komórka nabłonka
jelita — 3. w Twojej tkance”). The needs grow: ATP 60 × 1.15ⁿ⁻¹ (to 300), repairs 3 + (n − 1) (to 8), material
5 + (n − 1) (to 12); spare energy and material carry over. Pace (simulated): ~5 divisions in a 5-minute session
with strong focus and calm rests, ~4 at a realistic level; with no focus at all, none.

**Words: plain first, read twice.** „turbina komórki (syntaza ATP)”, „ekipa naprawcza (ligaza)”, „sprzątanie
(autofagia)”. Every caption stays ≥ 2.5 s + 70 ms a character and never under 4.5 s (`readSec`): Mito's lines, the
coach marks, the new cell's card, a Wiedza card. The key coach marks stay until the thing is done (the turbine
turned, the damage tapped — with a drawn hand tapping it —, the first material made); Mito finishes his line first,
then waits while a mark is up or queued (one voice at a time; a held line fades and waits, never cut). The first
damage's prompt goes before an explanation that waits; a mark about the push is never shown in a rest; the small ones
(energy, repair, ring, blind) are dropped once their moment has passed. Wiedza cards come only in a rest, one a rest,
after the reveal; the rest are listed in the summary and the lobby.

**Mito** says what matters: who he is, the first push („turbina kręci się tylko wtedy, gdy się skupiasz”), the gold
turbine, the blind block and its reveal, the first rest, a calm rest, the first repair, a double break, the
checkpoint, the division and the new cell, the traits, a lost signal; facts only in a quiet rest. Tapped, he says
what to do now. His lines about tapping have mouse twins.

**Removed in round 11** (each cost more understanding than it gave): Pełna moc (a hidden second meaning of the
turbine and a tap that competed with focus) → the automatic gold turbine; the turbine nudge (progress without focus);
two-tap repairs (one tap runs the whole pathway); the repair streak (it rewarded fast tapping in a push, §2.5); the
scroll-to-the-gate lane and the „genome scanned” share (the DNA bar counts repairs); dragging autophagosomes; ATP
flying to repairs (looked like the bar being spent); the sing-along line on phones (kept on a wide screen, under the
goal); the pumps' Roman numerals.

**Kept**: the turbine and its real numbers, the helix and its crews, autophagy, mitosis, Mito, the niches (gut crypt
from the start, skin after 2 divisions, bone marrow after 5; each its damage mix and its daughter), the tissue in
patches of twelve, the traits (mitochondria at 1 400 / 4 500 / 11 000 ATP, each +25 % — still only with focus;
enzymes at 25 / 80 / 180 repairs; lysosomes at 8 / 24 / 50 parts), 21 Wiedza cards with sources, the song (§ below),
the blocks (pushes 26 ± 4 s kept ≤ 30, a 3.5 s telegraph, judged once at the end from the last 15 s, blind every 4th
push from the 3rd session, `BlockContrast`), the closing passages.

**The song** (`song.ts`): unchanged — 92 bpm in G major, verse A, the series refrain, verse B, the refrain; its
layers follow the gauge in a sighted push, 0.3 in a rest, 0.42 elsewhere, hold in a blind push.

**Mobile first.** Upright: the now pill (30 px), the goal's sentence and the three chips (40 px), then the cell with
the lens (r ≥ 72 on the 360 × 366 band) over the lane (84–130 px, in the thumb zone), Mito top left with his bubble to
the right, the clean-up in the side columns. Only target: Mito (and the story card while up); the lane and the cell
are the play area (a tap anywhere sends the crew). On its side: the pill over the cell, the lens left, the goal
stacked right, the lane along the foot. Wide: the pill centred, the lens centred, the goal panel right, Mito with his
words over him and the clean-up in the left column. Words to read ≥ 13 px (the chips' counts 12), nothing under 11.

**Sources** (every number on screen):
* ATP synthase: the mammalian c₈ ring, 8 protons and 3 ATP a turn, rotation ~100 times a second — Watt IN et
  al. 2010, *PNAS* 107:16823 (doi 10.1073/pnas.1011099107); human c₈ — Lai Y et al. 2023, *Mol Cell* (PDB 8H9F);
  isolated F₁ ~130 rev/s — Yasuda R et al. 2001, *Nature* 410:898. 10 H⁺ per NADH (complex I 4, III 4, IV 2) —
  Watt 2010; Jones AJY et al. 2017, *J Biol Chem*; Wikström M et al. 2018, *Chem Rev*. Proton-motive force
  180–220 mV — Perry SW et al. 2011, *BioTechniques* 50:98.
* Body weight of ATP a day — Törnroth-Horsefield S & Neutze R 2008, *PNAS* 105:19565 (doi
  10.1073/pnas.0810654106). ~30 ATP per glucose — Flamholz A, Phillips R & Milo R 2014, *Mol Biol Cell* 25:3497.
  "Powerhouse of the cell" — Siekevitz P 1957, *Scientific American* 197(1):131 (doi
  10.1038/scientificamerican0757-131).
* 10–20 thousand DNA changes per cell a day — Lindahl T, Nobel lecture 2015 (up to 10⁵: Hoeijmakers JHJ 2009,
  *NEJM* 361:1475); up to 10⁵ UV photoproducts per skin cell in a day in the sun — Hoeijmakers 2009. Base
  excision replaces 1 nucleotide — Dianov GL & Hübscher U 2013, *Nucleic Acids Res* 41:3483; nucleotide
  excision cuts out 24–32 nt — Wakasugi M & Sancar A 1998, *PNAS* 95:6669; end joining in ~30 min — Mao Z et
  al. 2008, *DNA Repair* 7:1765; copying errs ~10⁻¹⁰ per base pair per division — Preston BD et al. 2010,
  *Semin Cancer Biol* 20:281. Nobel Prize in Chemistry 2015 (Lindahl, Modrich, Sancar) — nobelprize.org.
* Autophagy — Ohsumi, Nobel Prize in Physiology or Medicine 2016 (nobelprize.org); in starved yeast —
  Takeshige K et al. 1992, *J Cell Biol*. Lysosome pH ~4.6, several hundred per cell — Xu H & Ren D 2015, *Annu
  Rev Physiol* 77:57. PINK1 and Parkin on worn mitochondria — Narendra D et al. 2008, *J Cell Biol* 183:795.
* ~330 billion cells renewed a day, ~4 million a second — Sender R & Milo R 2021, *Nat Med* 27:45 (doi
  10.1038/s41591-020-01182-9). Gut lining 3–5 days (3.48 ± 1.55) — Darwich AS et al. 2014, *Drug Metab Dispos*
  42:2016 (doi 10.1124/dmd.114.058404); its Lgr5 crypt stem cells — Barker N et al. 2007, *Nature*. Epidermis
  39 days — Weinstein GD et al. 1984, *J Invest Dermatol* 82:623 (doi 10.1111/1523-1747.ep12261462). Over 2
  million red cells a second, ~120 days — OpenStax *Anatomy & Physiology* 2e §18.3; Sender & Milo 2021. "Usually
  one daughter stays a stem cell": on average — gut crypts divide symmetrically with neutral drift (Snippert HJ
  et al. 2010, *Cell*; Lopez-Garcia C et al. 2010, *Science*).
* Training: mitochondrial volume +40 % in 6 weeks — Hoppeler H et al. 1985, *J Appl Physiol* 59:320; PGC-1 —
  Wu Z et al. 1999, *Cell* 98:115.
* Mito's facts: his own DNA, 16 569 letters, from the mother — Anderson S et al. 1981, *Nature* 290:457;
  bacterial ancestors — Sagan (Margulis) L 1967, *J Theor Biol* 14:255; over 1 600 in a rat liver cell — Weibel
  ER et al. 1969, *J Cell Biol* 42:68.

### 13.13 What waits for the founder's go

The founder's generation rules (the `/generate` skill) need an explicit go for any music run and a
check-in after five images, and the founder was away: so this round's pictures are drawn in code like
every other game, and the songs are synthesised. Ready for a go: a set of painted pairs for Rozświetl
and pictures for the declarations of Ja jestem (drawn to the same compositions), and sung versions
of the four body songs with their original words in four languages.

### 13.14 Rzeki żywej wody — the meditation of light (the founder's second request of the day)

Later on 2026-11-12 the founder sent eleven pictures of chakra charts (seven-, twelve- and thirteen-point
systems, kundalini and nadi diagrams, a "God chakra" with the symbols of many religions) and wrote: *"I
want a visually beautiful meditation of concentration on energy points, from top to bottom and from
bottom to top; it should help to concentrate on the right spaces of the body and light them up by
concentrating; then we go on to the next centre. It must be beautiful."* — with the prayer *"przez
Jezusa Chrystusa Duchu Święty wypełnij to centrum energetyczne i niech popłynie czysta energia"*.

#### Round 10 (2026-11-17): every centre of the two pictures, the hands and the feet

**The founder's decision of 2026-11-17** supersedes round 4's "no chakra names, no symbols". After the first version
the founder wrote, twice: *"Rzeki wody żywej. Dłużej kafelki się powinny ładować. Tylko do faktycznej koncentracji
powinny się ładować. Chcę mieć też dłonie i stopy. Chcę wszystkie czakry z obrazków. Dodaj je tak, żeby uwzględniały
wszystkie warianty z obrazków."* — the glass should load longer, only from real concentration; hands and feet; every
centre of the pictures, all their variants — with a free hand to improve. It is the founder's app: **all the centres of
both pictures come in, with both pictures' names**. Picture 1 is the Sahaja Yoga chart "Energy centres & the subtle
system" (seven centres on the spine with Sanskrit names and numbers, the sacrum bone, the Void, the three channels, the
hand map); picture 2 is the twelve-point map (the seven, the soul, solar and earth stars, two shells round the body).
What stays from round 4 because it is right and the founder never objected: **the prayer** ("Przez Jezusa Chrystusa,
Duchu Święty, wypełnij … i niech popłynie …"), **a gift and a verse for every centre** (the Spirit is a Person; each
centre receives what Scripture names), the beauty (rose windows of church glass, the figure of light, the column, the
rivers, the egg of light), own words, the chorale. The names are the maps' names, shown as labels; the narrator never
teaches doctrine as fact; no text says that energy flows, wakes or heals ("energy", "kundalini", serpent, healing are
kept out by a test); the word "czakra" appears only inside the two names that carry it (Czakra galaktyczna,
Sakralchakra in de/sv). The kundalini in the sacrum is drawn as **a spiral of light of three and a half turns — never
a serpent**. Code: `src/arcade/rzeki/` (content.ts the stations and maps, tiles.ts their glass piece by piece, sim.ts
the session, layout.ts the layouts and the camera, figure.ts the geometry, render.ts the view).

**Seventeen stations** (content.ts `STATION`), in the full map's order from the top, each with a kind (how it is drawn),
its place, its glass (the pictures' colours), its rose window's tracery (unique), a gift, a verse down / up, a bell
(strictly falling along the full map, D4…E7 on the pentatonic ladder) and a framing (below):

| # | Station (pl · HUD tag) | Kind / where | Colour | Gift (pl / en) | Down / up |
|---|---|---|---|---|---|
| 1 | Boska brama · mapa 12 centrów | shell: the outer egg, its keystone window at the apex | white-gold | łaska / grace | Gen 28:17 / John 10:9 |
| 2 | Czakra galaktyczna · mapa 12 centrów | shell: the inner egg, starlight along its glass | indigo-teal | zachwyt / wonder | Ps 8:3-4 / Ps 19:1 |
| 3 | Gwiazda słoneczna · mapa 12 centrów | point, 0.31 H above the crown | gold-orange | światłość / light from above | Jas 1:17 / Isa 60:19 |
| 4 | Gwiazda duszy · mapa 12 centrów | point, 0.15 H above the crown | white-silver | pokrzepienie duszy / a restored soul | Ps 23:3 / Ps 42:1 |
| 5 | Korona · Sahastrara (7) | point, the crown; violet glass in a rainbow of petals (picture 1) | violet | pokój / peace | Phil 4:7 |
| 6 | Trzy kanały · Ida · Sushumna · Pingala | three lancets of glass along the body: Pingala gold on the viewer's left with a sun at its top, Sushumna white, Ida silver-blue with a crescent moon | gold / white / silver | droga / the way | Isa 30:21 / Ps 121:6 |
| 7 | Trzecie oko · Agnya (6) | point, between the brows | indigo | przejrzenie / clear sight | Eph 1:18 |
| 8 | Gardło · Vishuddhi (5) | point, the throat | blue | dobre słowo / a good word | Ps 141:3 / Heb 13:15 |
| 9 | Serce · Anahata (4) | point, the middle of the chest | green | miłość / love | Rom 5:5 |
| 10 | Dłonie · mapa dłoni 1–7 | twin: both hands become stained glass | the hand map's colours | błogosławieństwo / blessing | Ps 90:17 / Ps 63:4 |
| 11 | Splot słoneczny · Nabhi (3) | point, the upper belly | yellow | moc / power | John 20:22 / Eph 3:16 |
| 12 | Pustka, ocean · Bhavsagar | ring of sea-green glass round the middle of the body (picture 1's green circle) | sea green | cisza / stillness | Ps 107:29 / Ps 46:4 |
| 13 | Sakralna · Swadhisthana (2) | point, below the navel | orange | żywa woda / living water | John 7:38-39 |
| 14 | Kość krzyżowa · Mooladhara | bone: the triangular sacrum in five bands of pearl glass, a spiral of light (3½ turns) drawing itself as it fills | pearl, silver-blue | życie / life | Ezek 37:5-6 / Rom 8:11 |
| 15 | Podstawa · Mooladhara (1) | point, the base of the body | red | zakorzenienie / rootedness | Col 2:7 / Eph 3:17 |
| 16 | Stopy | twin: both feet become copper glass, their soles light the ground | copper | siła na drogę / strength for the way | Ps 40:2 / Ps 18:32 |
| 17 | Gwiazda ziemi · mapa 12 centrów | point, under the feet in the pool | earth brown and gold | wierność / faithfulness | Ps 85:11 / Isa 6:3 |

The **hand map** (picture 1, confirmed against Sahaja Yoga's chart decoding the centres on the hands; both hands
alike): 1 the wrist (root red), 2 the thumb (sacral orange), 3 the middle finger (plexus yellow), 4 the little finger
(heart green), 5 the index finger (throat blue), 6 the ring finger (third-eye indigo), 7 the palm's centre (crown
violet); the hands' glass lights in that order and each point shines as its pane is whole. English says "power" for
the plexus (pl „moc”) so it differs from the feet's "strength for the way" (pl „siła”). The prayers keep the founder's
form with a part of the person for each station — "wypełnij całe moje życie / moją małość / moje niebo / moją duszę /
mój umysł / moje dni i noce / moje oczy / moje usta / moje serce / moje dłonie / mój oddech / mój niepokój / moje
wnętrze / moje kości / moje korzenie / moje kroki / ziemię pod moimi stopami" — and the thanks name the gift
("…za zachwyt nad dziełem Twoich palców", the Spirit as the finger of the Father's right hand of the Veni Creator).
The HUD names a station with its maps' tag („Serce · Anahata (4)”, „Gwiazda duszy · mapa 12 centrów”), or with its
name alone when the band is too narrow for the whole; the summary says where the way goes on with each name in the
case it needs („Następnym razem: od Serca.”).

**Four maps** (the progress card chooses; the full map by default): *Wszystkie (17)*; *Dwanaście* — picture 2's
twelve: gateway, galactic, solar, soul, crown, brow, throat, heart, plexus, sacral, root, earth; *System subtelny* —
picture 1's eleven: crown, channels, brow, throat, heart, hands, plexus, void, sacral, sacrum, root; *Siedem, dłonie i
stopy*: crown, brow, throat, heart, hands, plexus, sacral, root, feet. Down walks a map's list (the light received from
above), up walks it reversed (thanks rising), both is down then up; after a whole round a new one begins.

**The glass, piece by piece** (tiles.ts, the founder's "kafelki"). A station's fill (0 → 1) opens its glass: a rose
window's oculus, inner petals (the first 30 %), then outer petals; a shell's keystone (the first quarter), then its 24
segments two at a time from the apex down both sides (or from the bottom up going up); the channels' sun and moon (the
first 12 %), then their three lancets pane by pane together (from the top down, or the bottom up); the Void's 16
segments two at a time; the sacrum's five bands while its spiral draws; the hand map's seven; the feet's instep and five
toes. One glass tick per piece (a whisper of glass climbing the ladder, a sparkle where it opened). A station waiting
for light shows its tracery as a ghost (a rose's lead, a hand's panes, a faint egg or ring).

**Light only from real focus, and slower.** The fill grows **only** in a push past its lead-in (5 s Mendi, 2 s HALO),
with a reliable signal, while `frame.focused`: `rate = fillFocus × (0.6 + 0.8 × clamp((level − 0.5) / 0.5)) × (1 + 0.5
× min(1, hold / 12))`, `fillFocus` 0.036 (rules.ts `focusRate`). **Nothing** fills in rest, the warm-up, the finale,
without a signal, below the threshold (a forgiven dip still loads at the base rate), or from taps; what is gained is
never lost (a test drives random signal, dips and losses and checks the light only grows). Focus while the light rests
in a full station or flows on loads the next station (≤ 0.25), so no focused second is wasted; a blind push loads unseen
by the same rule and is shown at its end (round 11: a blind push, too, ends when its station is full). The gauge
(`meter()`) is the band's real `level` in a sighted push past its lead-in, calm in rest, nothing without a signal, in a
blind block or elsewhere. Gold on the station — its halo, its threshold ring — means "the glass is loading" (sighted ∧
reliable ∧ focused), so the player sees exactly when concentration counts; "Złote światło" in the summary is that time.
**Measured in round 10** (superseded by round 11's measurements below; the sim, three seeds): a focus held steadily loads a station in **31 s at the threshold** and **18.5 s at
level 0.75** (21 s at 0.7); in a real 10-minute session (lead-ins, rests, blind pushes, the hold building up in each
push) a player at the threshold all push long gives ~37 s of focus a station and lights **6 stations**, at 0.75 ~22 s
and 10–11; with the kit's own `FocusInput` and noise and Mayer waves, a player with **no** rise in the pushes lights
**none** (the +1 % floor of the threshold), a 2 % rise lights **6–8**, a 4 % rise 10–11. The way therefore spans
sessions: the full map's 17 take about three 10-minute sessions down.

**The way goes on next session.** The progress keeps `pos: { map, dir, idx, fill }` — the station the light was at or
flowing to and the light gathered there — and the next session's light comes down (or up) to it; the stations it
already passed shine as lit. The summary says where ("Następnym razem: od Serca."), the HUD's first label too ("↓ Dalej
od Serca"), the narrator has a "resume" moment. In the progress card: "Kontynuuj od Serca" / "Od początku", and a tap
(or Enter) on any station of any map's album makes it the next start ("▶ tu zaczniesz") — the founder's "navigate". A
changed map keeps the station when the new map has it (else the top); a changed way keeps it on the way's first
direction.

**The drops tell the truth too.** In a push they flow only while the light loads (1.6 × (0.5 + level) a second); in rest
from calm with a signal (as before); the warm-up and the finale flow (1.2 a second: the smoke scores at once); a blind
push flows nothing until its end pays (60 × its share). A station lit +15, a whole way +60, a block judged well +20.

**The figure, the hands and the feet.** The silhouette is a union of the body's smooth outline (to the wrists and the
ankles), two real hands — a palm, four fingers a little apart and the thumb out, palms forward — and two feet seen from
the front with five toes; its rim is stroked outside the union only (what falls inside is erased), so no seam shows at
a wrist or an ankle. The light flows to the hands out along both arms from the heart and back, to the feet down both
legs, from the feet to the pool. **The camera** (layout.ts): each station names a framing — *body* (the layout as it
was), *sky* (the soul and solar stars: the room above the head), *heavens* (the two shells: the whole egg), *hands*
(near enough that a hand stands 75 px tall: 2.75× on the smallest phone (since round 11), none on a Full HD monitor), *ground* (the feet
and the earth star) — fitted into the stage, zoomed about the framing's middle with the figure's midline kept, moved no
further than it takes to bring the framing whole into the stage; it eases between framings (centre and log-zoom,
τ 0.9 s), during the flow to the next station, never jumping; when a way is whole it shows the whole map. The world is
drawn in the body framing's coordinates under one transform; every text is in screen space, so no zoom ever shrinks
it. The shells fade as the camera nears the hands or the ground, so their long lines never cross the words. The figure
and the windows are baked at the zoom the layout will show them (crisp hands at 2.7×).

**News for a player of the first version**: one card ("Wszystkie centra z obu obrazów", Ps 46:4) says what changed —
seventeen stations, the slower glass that loads only in focus, the way that goes on — once. **Progress v2**: a v1
save's counts move to the stations its places became (head → crown, eyes → brow, mouth → throat, heart, breath →
plexus, inner → sacral, feet), so its windows keep their craft tiers; everything else carries.

**Mobile first (§12).** One layout in three shapes as before (tall, side, wide/desk); `targets()` is the current
station's area through the camera (one area over both hands or both feet), ≥ 44 px, inside the insets, tested at
every `CHECK_SIZES` entry for every station, fill and framing, and on the camera's way between framings. On the
smallest phone a narrator's two lines over a prayer of three set both a little tighter (leading 1.2), and if even that
would not fit the narrator waits — the prayer is never cut. Text: the prayer ≥ 15 px, the label, the caption, the
breath and the cards ≥ 13, a verse's reference 11.

#### Round 11 (2026-11-17): a rest after every station, the breath, the twelve in sight

The founder, after playing: *"Rzeki wody żywej — chcę żeby faza odpoczynku była po każdej uzupełnionej sferze. Nie co
interwał. Faza odpoczynku powinna być wielokrotnością sekcji oddechowej (teraz 10 sekund = 4 wdech, 6 wydech). Chcę
żeby oddech można było konfigurować od 0 do 15 sekund wdech, wstrzymanie powietrza, wydech, wstrzymanie bezdechu.
Rzeki wody żywej z jakiegoś względu dalej nie mają wszystkich czakr (łącznie ich tam jest 12)."*  The last sentence
describes the deployed version (seven places); round 10's seventeen stations already hold all twelve of picture 2 —
but a player never *saw* them: in the body framing the stars above the head and the shells' keystones sit off the
stage, and a session walks a handful of stations.  So this round makes the whole map visible from the first second.

**Blocks go by the light.** A push block is the loading of one station: it has no fixed length (`signal().left` is
absent, the panel counts its seconds up) and ends when the station is full.  Then, at once, a **rest of whole
breaths** of the player's pattern (kit/breath.ts `breathRest(p, 26, 12)`, or the player's own count 1–12): it begins
with the pattern's first phase that has a length and ends exactly as a breath ends; the station shines full and its
verse is the one to abide in.  When the rest's last breath ends the next push begins and the light flows on (the
push's lead-in — 5 s Mendi, 2 s HALO — covers the 3 s flow).  The last station of a way: the whole figure in light
and the closing card come inside that rest; the next way begins when it ends.  Each push is judged once at its end
over its last ≤ 15 s (`RoundJudge.from(env.tuning)`, at least 8 reliable seconds in the window), a push under 10 s (a
station resumed nearly full) not at all; each rest likewise; `BlockContrast` across the session.  **Telegraphs:** the
rest when a sighted station is 85 % full or its last piece is opening (3–5 s ahead), the next push 4 s before the rest
ends, the quiet finale 4 s ahead; a blind push is never telegraphed by its fill (it would tell the hidden light).
**Blind pushes** stay every 4th from the 3rd session (never the first of a session); a blind push still ends when its
hidden light fills the station, which is then shown (1.6 s) as the rest begins.  The warm-up (the first time) waits
for the opening card.  The finale comes when the session's time runs out; a station in progress keeps its light
("what was gained stays", saved in `pos`).

**The safety valve.** A push that cannot finish — **60 s without any light gained** (no signal, or no focus), or
**150 s** in all while its station is under 85 % — ends into a rest of whole breaths (`why: 'valve'`): the narrator
"Odpocznij chwilę — to centrum zaczeka. Jego światło zostaje.", the now-line "Odpocznij chwilę — centrum zaczeka";
the station keeps its light and the next push loads it on.  It is judged like any push; it is no failure.

**Measured** (the sim): a focus held at the threshold loads a station in ~33 s of focus, pushes of ~38 s, **9 stations
in 10 minutes**; at level 0.75 pushes of ~26 s, 11 stations; with the kit's own `FocusInput` (noise, Mayer waves) a
player with **no** rise lights **none** and gets a valve's rest every ~60 s, a 2 % rise lights **9**, a 4 % rise 11.
The full map's 17 take about two sessions down.

**The breath** (progress v3: `breath`, `restBreaths`; a v2 save gets the default, `cleanBreath` on load).  The lobby's
card: presets as one-tap chips — *4 · 6 spokojny* (default), *5 · 5 równy*, *4 · 4 · 4 · 4 kwadrat*, *4 · 7 · 8
wyciszenie* — four −/+ steppers (44 × 44 px) *Wdech*, *Zatrzymanie (po wdechu)*, *Wydech*, *Bezdech (po wydechu)*,
each 0–15 s (0 skips the phase), *Oddechów w odpoczynku* −/+ with "auto · 3" and an *auto* chip, and a live line
"Odpoczynek: 3 oddechy · 30 s · Jeden oddech: 10 s"; a step that would leave a breath under 2 s is refused ("Tak
krótki oddech niczego nie poprowadzi: cały musi trwać co najmniej 2 s.").  In the rest the band's row is the guide:
a ring that swells in, stays full on a hold, settles out and stays small on the empty hold (a hold: still, a soft
glow), the phase's word (*Wdech / Zatrzymanie / Wydech / Bezdech*; en *Breathe in / Hold / Breathe out / Hold, empty*;
de *Einatmen / Halten / Ausatmen / Leer halten*; sv *Andas in / Håll / Andas ut / Håll tomt*), its seconds counting
down and "oddech 2 z 3"; the figure and its egg breathe with the lungs' fullness (still on a hold, a steady glow in
the chest); the wind rises over the whole in-breath and falls over the whole out-breath, a hold is quiet (one faint
low bell as it begins).  Every text that said "4 / 6" names the pattern now ("wdech 4 s, wydech 6 s"): the rest's
strategy, the coach mark, the how-to's tip, the summary's line "Po każdym centrum odpoczynek: …".

**The twelve in sight.** *The map column* (strip.ts): every station of the chosen map, top to bottom, as a column of
small jewels of church glass beside the figure — picture 2's twelve round, the five others (the three channels, the
Void, the sacrum, the hands, the feet) lozenges; lit in their glass (thanked: a gold rim), waiting as tracery with a
breath of their colour, the current one larger in a gold ring with an arc of its fill and a pointer to the figure,
gliding with the stream; the count over it ("6/17").  On a phone upright it runs down the left edge; on its side and
on a big screen it stands left of the figure's outer shell (on a big screen the group — column, shell, egg, words — is
centred); a desktop's mouse over a jewel names it ("Trzecie oko · Agnya (6)"); a coach mark points at it once ("Tu
cała mapa: 17 centrów, od góry do dołu. Złoty pierścień — tu jesteś.").  Its still part is baked per state, so a frame
draws one image and the marker.  *The shells read as stations*: each has its jewel on its own line, low on the side
away from the words (right on a phone upright, left elsewhere — where picture 2 writes their names), lit with it, gold
while it loads, and its name beside it ("Czakra galaktyczna", "Boska brama"), outside the shell where the screen has
room, else inside, in one line or two, never over the column, the words or the figure (13 px, 12 at the least on a
phone; none where none fits).  *The lobby*: the hero picture has the map column with its count; each map's card says
its count and where its stations come from ("17 · 12 centrów mapy dwunastu (obraz 2) + 5: trzy kanały, Pustka, kość
krzyżowa i dłonie (obraz 1) oraz stopy").  *The order* is checked against picture 2: from the top the outer shell
(Divine gateway), the inner (Galactic), the solar star above the soul star, crown, third eye, throat, heart, solar
plexus, sacral, root, earth star — a test pins the twelve in both "all" and "twelve".  **The default map stays
"Wszystkie (17)"**: it is the only one with everything the founder asked for (every variant of both pictures and the
hands and feet), all twelve are in it and now in sight; "Dwanaście" is one tap away.

**Clarity (the round-11 rules).** One line of **what to do now** between the band's label and the prayer, an icon and a
few words, changing only with the block: warm-up "Czytaj modlitwę i oddychaj spokojnie", push "Skup się na świecącym
centrum", blind "Skup się — w ciemności, bez patrzenia", rest "Odpocznij — oddychaj z postacią", the valve's rest
"Odpocznij chwilę — centrum zaczeka", the finale "Zostań w ciszy — sesja się kończy".  The narrator's lines and the
coach marks stay `max(4.5 s, 2.5 s + 70 ms × characters)`; a story card's page its reading time (title, text and verse,
at least 9 s) unless tapped.  The first time ever at a station the narrator glosses its name in plain words ("Pustka,
ocean · Bhavsagar — krąg wokół środka ciała").  The lobby's how-to: focus (gold = the glass loads), rest (whole
breaths, the rhythm set in "Postępy"), tap or click to stay with the centre; the last tip says the band measures
attention.  On the smallest phone the band grew to fit the now-line (110 px at least; the figure H 201) and the hands'
camera nears to 2.75× so a hand still stands 55 px tall.

**Beauty first** — it is a meditation, not an action game; the founder wrote "beautiful" three times.
*Deep space*: a gradient from near-black indigo through violet, soft nebulae added as light (violet,
indigo, rose, teal), dark dust lanes for depth, stars (a dozen twinkle), a vignette. *An open heaven*
above the head: a warm opening and soft rays fanning down to the crown, brightest as the light comes
down. *The figure of light*: a calm, gender-neutral person standing upright, seen from the front, palms
open forward (the posture of receiving); one smooth outline (head included, so the rim has no seam), a
translucent body warm where the light from above falls and cool below, an inner glow on the midline, a
rim gold at the head and shoulders and pearl-silver lower down; no face, no features — anyone can stand
in it. The head is a soft gradient, never a white fill, so its three places stay apart: the crown's window
sits just above the head, the eyes' at the brow, the throat's on the neck, their lit windows never touching.
The body **fills with light from its lit places**, each blooming inside the silhouette in its own colour,
with a warm wash when nearly all are lit — "the whole body in light" looks it. *Lit windows are jewels of
light*: church glass lit from behind — saturated, translucent petals of the place's colour over a ground of
the same glass, thin dark leading, a bright rim, a white-hot core, the glass drawn once more additively (the
light coming through) and a baked bloom of its colour spilling onto the body; only places not yet lit stay
dim (a faint outline, a ghost of glass). *The column of light* on the midline, faint all the way, bright
where the light has come. *Two threads*, gold and silver, spiralling along the lit stretch (their back halves
under the places, their front halves over them): the spiral runs down as the light is received, up as thanks
rise, slowly in rest, fast while the stream flows. *An egg of light* around the body that grows with each
place lit, deepens with calm and swells with the breath. *A pool of living water* at the feet, a reflection
of the column and a shimmer across it, and **two rivers** flowing out of it as the session's drops gather
(they reach the edges at ~700): meandering ribbons of water-light, wider toward the viewer, their edges soft
(four widths of light laid over each other), glints riding the current outward, their far ends thinning to
nothing. *Motes* drift up through the egg. Every "+N" rises beside the pool, where the drops fall — a lit
place's drops fall down the column as a bright drop of its colour and their number rises where it lands —
never over the column. Everything is baked once per size (the sky, the rays, the figure, the egg, the pool,
every rose window, the blooms); a frame only composes layers and draws a few dozen small shapes — no
shadowBlur, no filters.

**Rest — abiding.** The lit places shine steadily, the figure breathes with **the player's own pattern** (§13.14 Round 11; it swells around
the chest, the egg and the column swell and settle), the threads keep flowing slowly, the place still
deepens a little (`0.018 · (0.3 + 0.7 · calm)`), and **drops of living water** fall from the lit places down
the column into the pool (a plink and a ripple each), counted aloud every 3 s ("+5"): `1.6 · (0.4 + calm) ·
(1 + 0.6 · lit/7)` a second. The band shows the breath's turn and count (a ring that swells in and settles
out) and the place's verse to abide in — in pages of whole lines that turn slowly when it does not fit a
small phone, never cut. Calm held (≥ 0.5) is **abiding**; the session counts it and its longest stretch.

**Blind push — "w ciemności".** A veil of night over the figure; the halo and the window stand still, the
gauge, the pad and the chorale hold; the light gathers unseen (it may run past the place's full by up to
0.6, which the next place starts with) and at the block's end the window opens quickly to where it got
("+35% światła z ciemności") and the share is paid (60 × share drops). The headline flows at the base
meanwhile, so nothing leaks.

**The voice.** No chatty companion: the prayer is the voice. A calm narrator speaks at most one line at a
time (≤ 90 characters, 2–4 s, three variants a moment, never over a telegraph, the runner's banner, a story
card or a coach mark): at the start, the way down / up, each place going down ("Serce. Niech wypełni je
miłość aż po brzegi."), a place full, gold light, rest, the dark, the signal lost ("Opaska zgubiła sygnał.
To jej sprawa, nie Twoja — światło trwa."), a way whole, the end. **Story cards**: the first-ever session
opens with two pages — Isaiah 11:2 (the Spirit of the LORD will rest on Him) and the root, John 7:38-39 —
then the closing cards above.

**The strategies** (`signal().task`, "W głowie") are imagery and attention at the current place, changing
with it: "Poczuj miejsce między brwiami od środka; zobacz w nim ciepłe, jasne światło", "Wyobraź sobie
ciepłą wodę, która wypełnia serce aż po brzegi", "Wyobraź sobie źródło pod pępkiem, z którego wypływa
jasna, żywa woda"…; every third push the slow repetition ("Powtarzaj w myślach modlitwę tego miejsca słowo
po słowie, bardzo powoli") for those who do not picture easily; going up, every other push the rising
picture ("…jak dym kadzidła"). Rest's are the breath in the player's pattern, a soft forehead watching the drops, ten slow
breaths counted, abiding in the light already there. Never "concentrate harder".

**Sound.** A quiet chorale (hymn.ts on kit/song.ts, on by default, the card switches it): an original
hymn-like tune in D major at 54 bpm without words or drums — organ chords always, a bass that joins, a
bell melody, a harp of slow arpeggios when the light is high — its layers following the light in a sighted
push, a gentle level in rest, held in a blind block. Without it a warm pad in D whose filter follows the
light. A **bell for each place on the pentatonic scale by height** (D5 at the feet … E6 at the crown), so
the bells descend as the light comes down and rise as the thanks go up; a whisper of glass for each petal,
a chime and the shimmer of water when a place is full, a gliding shimmer as the light flows, all seven bells
when a way is whole, the breath's soft wind in rest following each phase of the player's pattern (still on a hold), a plink for each drop.

**Headline: drops of living water** (kropli / drops / Tropfen / droppar; 1 kropla, 3 krople, 5 kropli):
`1.6 · (0.5 + light)` a second in a push (the base in a blind one), rest's flow above, 1.2 a second
elsewhere, a place lit 15, a whole way 60, a block judged well 20, a blind block 60 × share. A 5-minute
session with mid focus and some taps gathers roughly 500–2 000; the smoke's crude input scores from the
first second.

**Blocks** go by the light (round 11, §13.14 "Round 11": a push lasts until its station is full, then a rest of whole
breaths), a 4 s telegraph, each judged once at its end over its last 15 s (`RoundJudge.from(env.tuning)`,
`BlockContrast` for the summary), every 4th push blind from the 3rd session (never the first of a session),
a warm-up the first time, a quiet finale. The summary: places in light, ways down and up, abiding, the
longest abiding, golden light, focus − rest; highlights (the way walked, the record or how far to it, more
than one way, the longest calm, the dark's share, own words); the closing passage in turn: an ascent
Psalm 141:2, a descent Luke 11:13, the first session John 7:38-39, calm rests Philippians 4:7, else Acts
2:17, Isaiah 11:2, John 7:38-39.

**Reverence (§13.4).** The Spirit appears only as light, water, wind and fire — no dove; Jesus is named in
the prayer only; no cross; no promise of healing or "energy", and the how-to's last tip says the band
measures attention, not prayer or holiness. The rose window here is church glass of a place (round
tracery), distinct from Ja jestem…'s stained-glass sketch of a picture; the living water is this game's
symbol.

## 14. Desktop first too: every game on a big screen (2026-11-13)

After the v4 round went live the founder wrote: *"now I don't see the games in the browser version. I want
two versions of the game interface: mobile (it exists) and desktop (it is missing now) — take the big
screen into account; choose the game's look from the detected screen and its parameters; and show the
games in every menu."* The audit agreed: on a Full HD monitor the app's column stopped at 1 200 px with
a third of the screen empty; inside a game the runner's HUD took the top 257 px and the dock the bottom
173 px, leaving a 1 920 × 530 band (3.6 : 1) for games designed for an upright phone, and `uiScale`
stopped at 1.3 — a phone's UI drawn a little larger in the middle of a big screen.

### 14.1 The screen decides (`kit/mobile.ts`)

* `screenKind(w, h, touch)` → `phone` · `phone-side` · `tablet` · `desktop` · `big`: a finger means a phone
  or a tablet whatever the size; a mouse with a desktop-sized canvas a desktop; one at least 860 px on its
  short side (`DESK_BIG`, a Full HD monitor's middle column and up) a big screen.  Games choose their
  layout family from it.
* `uiScale(w, h, max)` keeps the phone's 1 and the tablet's cap, and on a big screen grows past the cap with
  the canvas — `min(w / 880, h / 600)`, up to `DESK_MAX` 2.2: 1.35 in a Full HD monitor's middle column
  (1 190 × 960), 1.8 on a 2 560 × 1 440 monitor.  Smaller desktops (1 280 × 672–800, a 1 440 laptop) stay
  at their cap, so nothing changes there.
* `CHECK_SIZES` adds a laptop (1 440 × 662 under a top HUD) and the middle columns of a Full HD
  (1 190 × 960) and a 2 560 × 1 440 monitor (1 587 × 1 300) — every game's layout test audits them;
  `scripts/arcade-mobile.mjs` gains the devices `laptop`, `fullhd` and `qhd`.

### 14.2 The runner on a big screen

* **The HUD grows with the screen** (`--hud-k`, a mouse and a large window: 1.2 from 1 580 × 840, 1.35
  from 1 880 × 920, 1.65 from 2 300 × 1 200, 2 from 3 000 × 1 600): the top bar, the band's panel, the score,
  the dock and the cards zoom as wholes (the runner reads their real size for `insets()`), the banner and
  the coach mark scale their type.
* **Side columns on a wide big screen** (a mouse, at least 1 500 × 700, wider than 3 : 2): the band's panel
  stands in a left column with the game's title and how to play under it (`howToSide`: the goal, the hands
  with the keys, the tips — always in sight, so a desktop player never pauses to look), the score and the
  signal chart with its verdict in a right column, and **the game takes the middle at full height** —
  1 190 × 960 on a Full HD monitor instead of 1 920 × 530.  `hudTop()` now counts only the HUD that lies
  over the canvas (the top bar there), and an edge a column covers is no device edge in `insets()`.
  A laptop and anything narrower keep the top HUD and the dock below.
* **The left column holds whole lines** (`fitSide`, on every resize): the tips drop from the last until the
  how-to fits the window's height, so a sentence is never cut off; then, where the hands' rows alone are long
  (Glina, Źródła, Zacheusz, Dolina, Chleby, Ogień at 1 920 × 960), the goal — the lobby and the help card say
  it, and in play the controls are what the column is for.  Only what still overflows a short window fades
  out at the bottom (`clip`), and under 780 px of height the column is not shown at all.  Checked in every
  game at 1 600 × 860, 1 920 × 960 (pl, de, sv) and 2 560 × 1 300: nothing fades, and the column keeps 40 px
  and more clear of the band's panel above it.
* Mouse words: the how-to's chip for a tap says "Kliknij" without a touch screen.

### 14.3 Each game on a big screen (the desktop pass)

Every game, by its builder: the world and its art fill the big canvas (the camera zooms in, the board
grows, no phone layout lost in the middle); type and controls follow `uiScale`; the controls the mouse
uses again and again sit beside the play rather than in a phone's thumb zone; hover answers the mouse
(a highlight, a cursor), the keys are shortcuts listed in `howto()`; hints speak of clicking when there is
no touch; the phone's layouts stay exactly as they were (the audit's small, iphone and side devices).
Each game's part follows in §14.5.

### 14.4 The games in every menu, and the app on a wide screen

The founder's *"show the games in every menu"*: a player who opens Trening, the signal or the settings is
one click from a game, without going back to Gry.

* **A strip of games** (`ui/game-strip.ts`, `GameStrip`): a row of Start's game tiles (`activityTile`) that
  scrolls sideways, under the views that are not about games, each with its own choice (`pickGames`, at
  most ten, always topped up with the rest so a strip is never short):
  * **Trening**: the game of the day, then the visualisation and body games not played yet, then the recent;
  * **Sygnał**: the game of the day, then the recent;
  * **Sesje** ("Zagraj ponownie"): the recent first, then the game of the day, then the unplayed;
  * **Ustawienia**: the recent, then the game of the day;
  * **under a game's lobby** ("Więcej gier"): the game's own section first (its neighbours), then the game
    of the day and the recent; the game itself is left out.
  On a desktop two buttons page the row (‹ ›, hidden on a touch screen, which swipes); "Wszystkie gry"
  opens Gry.  A strip renders only when its list or the band changes.
* **Gry's section menu** (`#gamesNav`): chips for the sections (and the HolyHolyHoly games) that stay
  under the app bar while the page scrolls, so a big list of 29 games is one click from any section.
* **A wide app** (≥ 1 500 px: the column 1 640 px wide, Gry's grid in 4 columns, Start's tiles in 5,
  the activities in 3; ≥ 2 200 px: 2 100 px, 5 / 6 columns): a Full HD monitor no longer shows a phone's
  column with a third of the screen empty.  The strips show 4, 5 or 6 tiles at once with the screen.

### 14.5 Each game on a big screen

By its builder, in the registry's order: what the game looked like on a big screen before, what its desk
layout does, the mouse, and what was measured.

#### Geoda

On a Full HD monitor Geoda was the phone's side layout grown: a 520 px board
capped at 0.44 of the width, a phone's 13–16 px words, the dial and Bazyl far off, no answer to a resting
mouse. Now `screenKind` decides: a phone, a phone on its side and a tablet keep their layouts to the pixel; a
desktop or a big screen with a mouse gets the **desk**:

* **The board fills the middle.** As large as the band allows while a column on each side keeps room for the
  tray's five-cell bar at ~42 % of a board cell: 616 px on Full HD (520 before), 824 on 2560 × 1440 (696),
  centred, the columns hugging the geode. Left: the shine dial (r 79 / 105), the Szlif's bowl, Bazyl (127 / 169
  px) and his bubble; right: the goal in two lines (the chamber's number and name over its jewels), then the
  three slots down to the geode's foot. A short column (a laptop, a desktop under the HUD) gives the bowl the
  dial's place in a rest. Every word grows with the UI scale (1.35 / 1.8).
* **The mouse.** A resting cursor over the board shows the current piece where a click sets it, with the
  lines it would clear washed in light; a hovered piece's slot lights and the piece leans out; the cursor says
  what a click does (grab, grabbing, pointer). A dragged piece follows the cursor by the point it was taken
  (it grows around the cursor), its ghost where it lands. Keys stay shortcuts (Space/Enter the best spot, 1–3
  a piece), listed in the how-to.
* **Words for the hand.** "Kliknij, by zacząć", "Albo kliknij planszę — zarys pod kursorem pokazuje, gdzie
  kawałek wyląduje", "Kliknij pole — kawałek ląduje tam, gdzie pokazuje zarys; Spacja kładzie go w najlepszym
  miejscu"; the calibration tip and Bazyl's warm-up line became hand-neutral ("Wybierz pole na planszy").
* **Measured:** desktop / laptop / Full HD / QHD all checks passed, 0 strings under 13 px, game 0.65–0.73 ms
  (QHD 0.69, 0.99 before); the phone audit unchanged (0 under 13 px, 4 targets, 60 fps).

#### Latarnik

On a Full HD monitor's middle column the desktop's `wide` layout — made for a panel and a
score over the canvas's top corners — squeezed the night's pill into a 192 px column under a panel that was not there
("Sprowadź☆ 6 ł…", at QHD "NO…" and a 13 px goal), the card slot to 150 px, the ladder's words away, and pushed the sea
60–80 px off the middle. Now a mouse on a big canvas gets its own shape, `big` (phones, tablets and desktops keep theirs):

* **The sea in the middle, the deck in the corners.** The sea is centred in the band at 0.94 of the largest it holds —
  R 374 at Full HD, 513 on a 2560 × 1440 monitor, boats 37–51 px — and each corner holds a part of the deck fitted to the
  room the circle leaves, at the big UI scale (1.35–1.8): the night's pill top left (the night, its stars and the goal on
  one line at 14 px × u; on a big screen a long goal takes two lines rather than shrinking), the lanterns over the perfect
  ladder and its words top right, Zośka on her post bottom left with her bubble beside her (four lines of 14 px × u, its
  middle at her beak), the card slot bottom right. The last 6 % of the sea buys a deck that reads without a cut word.
* **A mouse.** The whole screen is the button: a pointer cursor over the sea, a click anywhere flashes, Space and Enter
  are the keys (the how-to's keys row). The deck answers the mouse: the part under it lights up in gold and says what it
  is beside it — the pill the stars' rule, a line per star; the lanterns what puts one out; the ladder that eight
  perfects bring Pełne światło — and lets go when the mouse rests 6 s or leaves; Zośka flaps when the mouse finds her.
  The how-to says "Kliknij w dowolnym miejscu, gdy promień jest na łodzi", the armed ladder "Pełne światło — kliknij"
  (four languages); the calibration card's tip names no gesture.
* **Measured** (scripts/arcade-mobile.mjs): desktop / laptop / Full HD / QHD 0 strings under 13 px, the story card the one
  target, the game's frame 0.54 / 0.52 / 0.76 / 0.63 ms; the phones unchanged (small, iPhone, on its side: R 145 / 175 /
  132, 3 strings at 11–13 px as before). Tests: the big shape grows (≥ 0.9 of the band, ≥ 1.25 × a desktop's sea, the deck
  ≥ 1.35 ×, no overlaps), every phone, tablet and desktop keeps its numbers, the mouse's answers, the words at both sizes.

#### Motylarnia

Slither on a big monitor: the garden stopped at the desktop's zoom of 2 (a ~230 px
caterpillar on a 2560 × 1440 screen), Hieronim stayed at 1.2 in his corner with a 14 px line, the flowerbed (the
band's last 40 s) a 46 px strip with a 13 px tag, the flying words at a phone's sizes; the mouse steered and sprinted
already, but the default arrow and nothing at the pointer said so. A mouse on a big screen now gets `big` (phones,
tablets and desktops keep every number):

* **The garden closer with the screen.** The zoom grows past 2 with the UI scale (2 × u / 1.35: 2.0 at Full HD, 2.67 at
  QHD), so both monitors show the same ~594 × 410 units of garden, the bigger one larger; it still zooms out as the
  caterpillar grows. Hieronim, his line (14 px × u), the side goal's pill, the twig (58 × u), the flowerbed (36 × u, its
  tag 13 px × u) and the flying words grow with the screen.
* **A mouse.** The pointer steers and a held button sprints, as before; now a crosshair over the garden (a hand while a
  card waits for a click) and an aim ring at the pointer — cream while it crawls, gold and filled while it sprints —
  with a faint dotted line from the head, gone when the mouse leaves. Keys ←/→ turn, Space sprints (the keys row); the
  calibration card's first tip names no finger ("Prowadź gąsienicę z dowolnego miejsca ekranu…", four languages).
* **Measured**: desktop / laptop / Full HD / QHD 0 strings under 13 px, the game's frame 0.85 / 0.73 / 0.91 / 0.91 ms;
  the phones unchanged (0 strings under 13). Tests: the big garden, every other size's numbers kept, the mouse's
  answers through the game.

#### Arka

On a Full HD monitor Arka kept the desktop's `wide`: its bar rose into the band
between the Mendi panel and the score — which on a big screen stand beside the canvas, so the bar sat up under
the runner's top bar — and the deck stayed a 458 px column (the biggest deck at 48 px cells) with empty sky and
water either side. Now `screenKind` decides: a phone, a phone on its side and a tablet keep their layouts
(checked against the old code), the desktop under the top HUD keeps its risen bar, and a big screen with a mouse
gets its own:

* **The deck takes the middle.** The bar right under the top bar, the deck as large as the band allows across
  the whole middle (turned a quarter where that gives larger cells): on Full HD the biggest deck's cells 48 →
  71 px, 7 × 8 62 → 91, 5 × 6 87 → 114; the new land along the foot with the waiting firsts on both sides of the
  gangway; the raven right of the hull, talking above himself in the margin (the deck stays clear) and holding
  his line while a coach mark is up (the runner's bubble may stand there); the dove's pill grown (70 px). The
  bar, the dove, the raven, the flying words, the cards and the mist's tag grow with the UI scale — the cards
  drawn at a phone's size and scaled, crisp.
* **The mouse.** A resting cursor rings the animal a click would send and lifts it a little — a free one and a
  blocked one alike: the ring tells which animal, never whether its way is free (that stays the puzzle and the
  mist's reward); the dove's pill lights; the cursor says what a click does. Keys stay shortcuts (the arrows and
  Enter, Space or H for the dove).
* **Words for the hand.** "Kliknij zwierzę — pójdzie tam, gdzie patrzy", "Kliknij, by grać dalej"; the
  calibration tip "Wybierz zwierzę…" to every hand.
* **Measured:** desktop / laptop / Full HD / QHD all passed with no string under 13 px (2 before), game
  0.61–0.85 ms; the phones unchanged (0 under 11 px).

#### Urodzaj

In a 2560 × 1440 monitor's middle column the wide layout's "rise between the runner's
panel and score" fired under a top bar that spans the whole width: the scene's top at 10 px, under the 118 px bar; the
circle of fruits stopped at r 110 with 16 px fruit beside a 794 px basket, the flying words at a phone's 16–34 px; the
how-to's first row told a mouse "Przeciągnij". A mouse on a big screen now gets `big` (phones, tablets and desktops
keep every number):

* **The basket as tall as the band, under the top bar** — S 504 at Full HD, 696 at QHD, its scene 0.97 of the band's
  height and 47–49 % of its width; the circle of fruits grows with the screen (r 121 / 160, its fruit up to 16 × u),
  the flying words and the wheat of the band's last 40 s too (× u).
* **A mouse.** Feliks follows the hovering pointer and a click drops, as before; now a pointer cursor, and resting on
  a fruit of the circle rings it in gold and names it ("4 · Figa"), on the next fruit "Następny: oliwka" (14 px × u),
  gone after 6 s still or when the mouse leaves. The how-to's first row is "Steruj: Przesuń myszą — Feliks niesie owoc
  nad koszem"; the keys ← → / A D and Space / Enter / ↓; the calibration card's first tip names no finger ("Prowadź
  Feliksa nad koszem i upuść owoc tam, gdzie ma spaść…", four languages).
* **Measured**: desktop / laptop / Full HD / QHD 0 strings under 13 px, the game's frame 0.55 / 0.51 / 0.63 / 0.49 ms;
  the phones unchanged (1 string at 11–13 px, the verse's reference). Tests: the big layout, every other size's numbers
  kept, the mouse's answers.

#### Wzlot

Tiny Wings' camera stopped at 290 × u px a screen height: in a Full HD monitor's middle
column, over low ground, the hills were a strip along the foot, a 51 px eaglet at the bottom left and two thirds of
the canvas sky; and the how-to told a mouse "Kliknij: Puść na podejściu" (the release row's `tap` gesture is named
"Kliknij" without a touch screen) and "Spacja albo ↓ działają jak palec". A mouse on a big screen now gets `big`
(phones, tablets and desktops keep every number):

* **The world closer.** 2.2 screen heights across and no cap below that: 541 px a screen height at Full HD (was 392),
  721 at QHD (was 523) — the eaglet 70–94 px, the hills fill the lower half, still 1.5 screen heights of slope ahead;
  a high flight zooms out to the band's height as before.
* **The band's gauge in sight.** The sun's arc stands lower and flatter (its noon 135 × u under the top bar), so the
  runner's block banner no longer hides the sun and its threshold ring for the 4 s a push block begins; a coach mark
  over the bigger eaglet stops above its head.
* **A mouse.** A pointer cursor over the sky, a closed hand while a button holds the dive; resting on the sun, the
  night at the arc's end, a warm column or the grań's flag rings it in gold and says what it is (the coach marks'
  words, 13.5 px × u) — never during a hold, gone when the mouse rests 6 s or leaves; a card lights under it. The
  how-to's first row is one line for the hold and the let-go ("Przytrzymaj przycisk myszy w dół zbocza, puść na
  podejściu…"), the keys "jak przycisk myszy"; four languages.
* **Measured**: desktop / laptop / Full HD / QHD 0 strings under 13 px, the game's frame 0.54 / 0.45 / 0.62 / 0.48 ms;
  the phones unchanged (1 string at 11–13 px, the verse's reference). Tests: the big camera, every other size's numbers
  kept, the mouse's answers, the words at both big sizes.

#### Glina

With a mouse on a desktop or a big screen (`screenKind` desktop / big, landscape —
layout.ts `desk`) the pot is the hero: its stage is 0.2 of the width (≤ 265u; 238 px in a Full HD monitor's middle
column, 317 on a 2560 × 1440 one, was 202 / 270) and the wheel up to 172u; the workshop around it (the ticket, the
customer, the kiln and its dial, Szamot on the shelf) grows with u as before. Gotowe stands right of the wheel and
clear of the pot's widest on every landscape screen (a laptop's had overlapped the stage), and the glazing palette's
Gotowe right after the colours' row, beside the piece, instead of in a phone's corner. **The mouse:** the pointer is
the potter's hand — over the clay a ghost of the hand shows where a press would take the wall, or a dashed line the
rim's new height (the cursor a grabbing hand, then grabbing); a swatch gets a ring of light, a chip lights, both
Gotowe lighten with a rim; on the glazing piece a dashed ring shows the band a stroke would paint; the cursor is a
pointer on every control, on a card and on the kiln's needle. Keys: Space or Enter finish the step (Gotowe, the
order's glaze, the firing), 1–8 pick a glaze — in the left column. Words without a touch screen: "Ciągnij myszą po
ścianie…", "Kliknij kolor i maluj paski myszą; przy piecu kliknij…", "Kliknij w zieleni!", "Kliknij, by dalej" and
keyboard variants of the coach marks; Szamot's lines are device-neutral. Measured: desktop / laptop / Full HD / QHD ✓,
the game's frame 0.75–0.92 ms; the phone's layouts unchanged (small / iphone / side ✓).

#### Źródła

On a Full HD monitor Źródła was the desktop's three columns spread over the
canvas: a 679 px valley centred with empty bands above and below, the dispenser in the bottom-left corner (the
next stone ~100 px under the valley), the dial (capped at r 66) in the top-right corner, the words capped at
1.15×. Now `screenKind` decides: a phone, a phone on its side and a tablet keep their layouts (checked against
the old code); a big screen with a mouse gets its own:

* **The valley fills the middle, the columns hug it.** Cells up to 72 px of UI and a third more: on Full HD a
  7 × 5 valley 97 → 114 px cells (798 px wide), on 2560 × 1440 129 → 153; the dispenser right beside it with the
  next stone level with the valley's foot and the four after it stacked over it (Pipe Mania's chute; after a lay
  the next stone pops into its frame, so nothing crosses "Następny" on its own row); the dial
  (r 70 / 94) level with the valley's top with its name, the goal and the help's words under it; Kumka at the
  valley's foot. Every word grows with the UI scale; the story cards are drawn at a phone's size and scaled.
* **The mouse.** A resting cursor shows the next stone in the cell where a click lays it — gold where it can go,
  rose where not, with a pointer or a not-allowed cursor — the finger's aim without the finger; a click lays it
  there. The next stone and the dial take a pointer (Kumka's help). Keys stay shortcuts (Space, F, the arrows,
  Enter).
* **Words for the hand.** "Kliknij pole: kładziesz tam następny kamień…; kursor pokazuje go w polu", "Kliknij
  następny kamień albo zastawkę…", "Kliknij, by iść dalej"; Kumka's lines and the calibration tips say "wybierz"
  to every hand.
* **Measured:** desktop / laptop / Full HD / QHD all passed with no string under 13 px (the opening card's
  reference was 11), game 0.64–0.89 ms; the phones unchanged (0 under 11, the kit's verse reference at 11).

#### Posłaniec

The pseudo-3D road already scaled with the canvas (the road fills the middle column, the messenger stood
~250 px tall on Full HD), so the pass is about the view, the sky and the hands. `layout()` takes the screen's
kind (`screenKind(w, h, env.touch)`); a finger keeps the phone's layout exactly (a test compares them).

* **A desktop's longer lens** (desktop and big): the camera rides 13 m behind him instead of 10 at the same
  height on screen — the road ahead is drawn ~22 % larger in the same place (30 m ahead ×1.22), so obstacles
  read sooner; the cast is ×1.1 (277 px on Full HD, 375 on QHD). What he has passed fades a metre behind him
  over four, so a beam does not sweep across the foreground on its way past the camera.
* **An open sky**: where only the runner's top bar lies over the canvas (a wide big screen's side columns hold
  the panel and the score) the quest pill, the ribbon of dawn and Klekot's gauge share one row along the top;
  the ribbon grows with the screen (758 × 97 px on Full HD, 1011 × 130 on QHD; it was ≤ 620 × 84) and Klekot
  speaks from under his gauge, beside the road, his bubble's tail up to him. A laptop's top HUD keeps the old
  arrangement.
* **Keys first**: the how-to lists ⌨ ←/→ A/D, ↑ W Space, ↓ S first at a keyboard, then "Kliknij" (a side —
  a lane, the middle — a jump) and "Przeciągnij" (a mouse drag as the swipe); the coach marks name the keys and
  then the mouse ("lub kliknij środek", "lub przeciągnij myszą w dół", "lub kliknij z boku").
* **Hover**: the mouse resting over the road shows what a click would do — the lane it steps into glows on the
  paving with a chevron at his knee, or a double chevron rises over his head for a jump; it fades a second
  after the mouse stops, so a player on the keys is not followed by it. A pointer cursor in play.
* **Measured** (`scripts/arcade-mobile.mjs`, desktop / laptop / Full HD / QHD): 0 strings under 13 px, the
  story the one target, 60 fps, the game's frame 0.91 / 0.8 / 1.0 / 0.99 ms (QHD 1.3 before); the phones
  (small, iPhone, on its side) unchanged.

#### Zacheusz

On a Full HD monitor Zacheusz was a phone's street lost in a big canvas: the scene stopped at a tablet's cap
(52 × u px a unit, the 80 px clamp on QHD), so Zacchaeus stood 70–80 px tall under ~9 units of empty sky,
and the bubble button floated in the bottom-right corner, ~1 100 px from him on a 2560 monitor.  `layout()`
now takes the screen's kind (`screenKind(w, h, env.touch)`); a finger keeps the phone's layout exactly.

* **A desktop's street** (desktop and big): no thumb's pad — the ground band is 16 % of the canvas and holds
  Mela's lines and the button; the scene grows with the screen (px a unit = the height's room for the light
  road, his jump and a coin, or the width over 12.5 units): **Zacchaeus 95 px on Full HD, 127 on QHD** (a
  tenth of the canvas), running at 22 % of the width with **~1.9 s of street ahead** (a phone 1.2 s).
* **The bubble button by the play**: under the street a few strides ahead of him, its label to its right with
  its key — "Bańka · B" — and Mela's box on its left under her; never in a corner.  A ring lights it while the
  mouse rests on it; the cursor is a pointer in play (any click jumps).
* **Keys first, clicks for taps**: the how-to lists the keys first at a keyboard (Space / ↑ — jump, hold —
  higher; B / ← — a bubble), then "Kliknij albo Spacja — skok…", "Przytrzymaj (przycisk myszy albo
  Spację)…", "Bańka pod ulicą albo B…"; the coach marks for a jump, a hold, a pause stone, a wall, the dash
  arrow, the bubble and the button name the click and the key; the cards say "kliknij albo Spacja — dalej";
  Mela's "Stuknij, a skoczy" becomes "Kliknij, a skoczy"; the lobby's map "kliknij poziom".
* **Measured** (desktop / laptop / Full HD / QHD): 0 strings under 13 px, the button and the cards
  finger-sized inside the play, 60 fps, the game's frame 1.03 / 0.71 / 1.05 / 0.82 ms; the phones (small,
  iPhone, on its side) unchanged.

#### Pasterz

On a big monitor the hill was a phone's camera stretched: the scale stopped at 48 px a metre, so a Full HD
column showed 25 m of hill and a 2560 monitor 33 m, with sheep the size of a phone's; the mouse drove a
floating joystick, and Łatek's button sat in the bottom-right corner.  `layout()` takes the screen's kind
(`screenKind(w, h, env.touch)`); a finger keeps the phone's layout exactly.

* **The camera comes closer on a big screen**: 18 m across without the phone's cap — 55 px a metre on Full HD,
  75 on QHD: sheep two to three times a phone's while a little more of the hill (21 m) stays in sight; the
  camera still zooms out as the flock grows.
* **The mouse walks him to the pointer**: held on the field, the shepherd walks to the pointer (full speed with
  it 2.5 m away, slower near it, standing within half a metre) — the desktop's "point and go" instead of a
  joystick; a click whistles, as a tap does.  The hover answers: a ring at the pointer and a dotted way to it
  from the shepherd; held, a gold wedge at his feet toward it.  A pointer cursor in play.
* **Łatek's button under the shepherd** at the bottom's middle (he stands in the field's centre), a little
  larger on a big screen, its label with its key: "Gwizdnij · Spacja"; a ring under the mouse.
* **Keys first**: arrows/WASD walk, Space/Enter whistle, then "przytrzymaj przycisk myszy — pasterz idzie do
  wskaźnika" and "kliknij (albo Spacja) — Łatek przygania…"; the steer coach mark and the warm-up's panel tips
  in the mouse's words.
* **Measured** (desktop / laptop / Full HD / QHD): 0 strings under 11 px (under 13 only a rival's name fitted
  to the ranking), 60 fps, the game's frame 1.12 / 1.16 / 1.39 / 1.18 ms; the phones unchanged.

#### Anioł Stróż

On a Full HD monitor's middle column (1 190 × 960) the desktop's layout fell back
to its "window under the HUD" branch: a 1 154 × 200 px window across the top — the band's last 40 s drawn a
second time beside the runner's chart — over a room at ±5.2 u (114 px a unit; 130 on QHD, the old cap), the story
card hanging over the angel, three wide key caps and a row of gift cards at the foot.

* **The screen decides** (`layout(w, h, insets, touch)` → kit `screenKind`): a mouse on a big canvas gets the `big`
  mode; the phones, the tablet, the desktop and the laptop keep their layouts exactly (a test compares a finger's
  and a mouse's layout at every other `CHECK_SIZES` entry).
* **The room fills the screen**: ±4 u across — 149 px a unit on Full HD (1.3× before), 198 on QHD (1.5×); the floor
  at 87 % of the height, three key caps under it (48 u tall, the thirds still strike as a mouse expects); a window
  centred on the wall, two thirds of the width and as tall as the room leaves (125 / 193 px), its sill and the
  night's level bar under it; the boss's light bar on the wall beside the window.
* **Words beside the play**: the toasts and the story card (700 u wide, the opening's verse on one line) stand over
  the window band and never come below the angel's wing tips.
* **Gifts**: a dialog in the middle of the room — three 297 × 189 cards (396 × 252 on QHD), a larger picture, the
  name and what it does at 1.2–1.5× a phone's type, a key cap "1/2/3" in the corner.
* **The mouse**: the third under it lights its key cap; **the aim** rings the Zmora (or the ink drop) a click there
  would hit, a gold chevron over it, brighter in the perfect band, or lights the reach's arrow where the click
  would strike the air (`sim.aim`, the pads' own reach); the card under it lifts; a hand cursor wherever a click acts.
  Keys as before (←/→ A/D, Space, 1–3), listed in the side column; mouse words in the tips and the Ciągutek's mark.
* **Measured**: 0 strings under 13 px at desktop / laptop / Full HD / QHD; the game's frame 0.71 ms on Full HD and
  1.02 ms on QHD (budget 4); the phones' audit unchanged (0 under 11 or 13, six targets).

#### Zastępy

The desktop keeps the whole 30 m road in view, so on a Full HD monitor's middle column
(1 190 × 960) the road's scale was set by the width — 33 px a metre (43.5 on QHD) — and the road lay right over the
controls: a thin strip of 50 px angels under 450–600 px of empty sky.

* **The screen decides**: a mouse on a big canvas (`screenKind` 'big') gets its own road; the phones, the tablet, the
  desktop and the laptop keep theirs exactly (a test compares a finger's and a mouse's layout at every other size).
* **The road comes closer**: 22 m across (`BIG_VIEW`) — 54 px a metre on Full HD, 72 on QHD (1.66× before); the camera
  follows the front as on a phone, a drag pans. The road stands at seven tenths of the band like the phone's: the sea of
  clouds and the causeway's pillars below, the gates, the fliers and taller banners (the band's last 40 s) above.
* **The mouse**: the card under it lifts with a white ring, the pillar's and the trumpet's buttons ring gold, an offer
  warms; over the road a ghost pillar of cloud shows where a click would raise it while it is ready. The cursor says
  what a click does — a hand on a card, a button, an offer, the road with the pillar ready, a grab where a drag pans —
  from the same order as the HUD's hit test. Keys as before (1–7, Space, H, T, Enter); the side column and the coach
  marks speak of clicking.
* **Measured**: 0 strings under 13 px at desktop, laptop, Full HD and QHD; the game's frame 0.99 ms on Full HD and
  0.72 ms on QHD; the phones' audit unchanged (0 under 11; under 13 only "≈ 5 s", a locked card's gate and the verse's
  reference).

#### Firmament

On a Full HD monitor Firmament was the desktop's `wide` grown: a 568 px board
pinned to the band's top with ~280 px of empty sky under it and the tray in the far corner; on a 2560 × 1440
monitor the board even rose under the runner's top bar (the layout counted on a 58 px bar between the panel
and the score, which on a big screen stand beside the canvas), and the cards and Bubo's words stayed capped at
1.15×. Now `screenKind` decides: a phone, a phone on its side and a tablet keep their layouts (checked against
the old code), the desktop under the top HUD keeps its board risen between the panel and the score, and a big
screen with a mouse gets its own:

* **The sky fills the middle.** The board as large as the band allows between two ~150 px columns, centred:
  696 px on Full HD (568), 936 on 2560 × 1440 (776). Left: the goal card, Bubo at the column's foot with his
  bubble above him (never over the board's edge); right: the telescope and its words, the tray's slots (86 px
  on Full HD) level with the board's foot. Every word follows the UI scale (1.35 / 1.8), "RUCHY" included, and
  a constellation's name shows only where it fits whole.
* **The mouse.** A resting cursor rings the body a click would take — gold beside the selected one, where a
  click swaps; a tool's slot lights under it; an armed hammer's or ray's strike follows the cursor (a
  crosshair) and lands on the click. The cursor says what a click does; a drag swaps as a swipe does. Keys stay
  shortcuts (Space the hint, the arrows and Enter, 1–4 the tools).
* **Words for the hand.** "Kliknij, by zacząć", "Kliknij pole: młot rozbija jedno", "Masz przyrząd! Kliknij go
  (albo 1–4)…", "Kliknij przyrząd z teleskopu, potem pole na niebie — celownik pokazuje, gdzie uderzy"; the
  calibration tip says "wybierz dwa po kolei" to every hand.
* **Measured:** desktop / laptop / Full HD / QHD all passed with no string under 13 px, game 0.58–0.65 ms; the
  phones unchanged.

#### Dolina

The valley kept a phone-on-its-side scale on a big monitor — 17 units across with an 82 px cap — so the pilgrim
stood ~100 px tall on Full HD and ~120 on a 2560 monitor under a tall dark sky.  `layout()` takes the screen's
kind (`screenKind(w, h, env.touch)`); a finger keeps the phone's layout exactly.

* **A desktop's valley** (desktop and big): 13 units across and no phone's cap — 91 px a unit on Full HD, 122
  on QHD: the pilgrim a tenth of the canvas (~130 / ~170 px), a quarter of the way in, with about two seconds
  of road ahead; the room above the floor still holds a ledge, both jumps and the high gate under the HUD.  The
  pack's row (sword, stones, oil) and the cards grow with the screen.
* **The keys first**: Space / ↑ / W jump (held — higher), ↓ / S stomp; the mouse plays the same verbs — a click
  jumps, a second in the air is the double jump, a held button goes higher, a drag down stomps — and the
  how-to, the warm-up's tip and the lobby's party speak of clicks ("Kliknij gdziekolwiek…", "Przytrzymaj
  przycisk myszy…", "Przeciągnij myszą w dół…").  A card or toast under the resting mouse lights its rim (a
  click closes it); a pointer cursor in play.
* **Measured** (desktop / laptop / Full HD / QHD): 0 strings under 13 px, the cards finger-sized inside the play,
  60 fps, the game's frame 0.67 / 0.91 / 0.7 / 0.86 ms; the phones (small, iPhone, on its side) unchanged.

#### Chleby i ryby

On a big screen the desktop's lane already filled the canvas and its loaves grew with
it (77–110 px a unit), but what the desktop capped at a phone's size stayed there: a 52 px boy smaller than his own
loaves on QHD, a 64 px help button, a 30 px row of baskets, side sheets that cut the village's names.

* **The screen decides**: a mouse on a big canvas (`screenKind` 'big') gets big sizes; phones, the tablet, the desktop
  and the laptop keep theirs exactly (a test compares a finger's and a mouse's layout at every other size).
* **Grown with the screen**: the boy and his basket follow the lane — 70 px on Full HD, 94 on QHD; the help button 70 /
  94 px across; the baskets' row 30 / 40 px; the side sheets 36 % of the play (428 / 571 px), the lane sliding clear.
* **The mouse**: before a click a dotted line runs up the lane from a ring at the basket's row — where a click would pour
  (a press aims at the pointer at once); the help button and the giant loaf ring under it, a village row warms, "Dalej"
  lightens. The cursor: a crosshair over the lane, a hand on the help, the giant loaf, a row, a story or the reveal.
  The side column and the coach marks speak of holding the mouse button, moving the mouse and clicking (keys as
  shortcuts: ←/→, Space, E, 1–3); Mirka's lines name no hand.
* **A reveal's words wait until a tile has turned** (on every screen): mid-turn they were squeezed under the 11 px floor.
* **Measured**: 0 strings under 13 px on Full HD and QHD; the game's frame 0.65 ms on Full HD and 0.89 ms on QHD; the
  phones' audit as round 7's (0 under 11; under 13 only "próg", the verse's reference and "z").

#### Jerzy i smok

The desktop caps the field's scale at 56 px a unit, so a QHD monitor's column showed a
28 × 21 u field with a 70 px knight and 30 px brood, and the Miecz światła's dial sat in a phone's thumb corner, far
from the play.

* **The screen decides**: a mouse on a big canvas (`screenKind` 'big') gets its own field and dial; phones, the tablet,
  the desktop and the laptop keep theirs exactly (a test compares a finger's and a mouse's layout at every other size).
* **The field comes closer**: about 18 × 13 u in sight on any big screen — 65 px a unit on Full HD, 89 on QHD (1.16× and
  1.58× the desktop's) — more of the field than a phone sees, the knight, Linda and the brood grown with the screen.
* **The dial under the knight**, at the bottom's middle (82–96 px), its label over it: a mouse never travels to a thumb's
  corner; Space or a click anywhere still lets the sword go.
* **The mouse**: the card under it lifts with a gold rim, the reshuffle and the story's button warm, the dial rings; the
  cursor says what a click does — a grab on the field (a drag walks), a hand while the sword is ready, on a card or a
  button. Cards show their keys as caps; the side column and the coach marks speak of clicking; Linda's lines name no
  hand. The story's verse grows with the screen (its reference ≥ 13 px).
* **Measured**: 0 strings under 13 px on Full HD and QHD (one before); the game's frame 0.92 ms on Full HD, 1.09 ms on
  QHD; the phones' audit unchanged.

#### Dawid

On a phone David's world is a thumb's; on a desktop it is a mouse's and a big
screen's. `layout(w, h, insets, touch)` takes the family from `screenKind`: a finger keeps the phone's layouts
at any size; a mouse on a desktop or a big screen gets a desktop's.
* *The world fills the screen.* The camera zooms with a big canvas: about 14.5 × 11 u in view (80 px a u in a
  Full HD monitor's middle column, 109 on a 2560 × 1440 one; the phone's map stopped at 66, so QHD showed 24 u of
  meadow with David 85 px tall — now he is ~140 px). A desktop under the top HUD keeps the phone family's height.
* *An action bar under David.* The great stone and the bag stand side by side in the middle of the bottom edge,
  right below him (not in a thumb's corner), 54–97 px discs with their key caps (the space bar, B). The party,
  health, the level and its bar and the treasury stack in the hero's frame at the bottom left, never wider than
  340·u (on Full HD the bars had run 1 000 px across). The quest pill carries Q, the minimap is 150·u, the camp's
  sheet comes from the right in three columns with 1–4 on its tabs.
* *Hover answers.* Every control lights up and the cursor becomes a hand; after a moment's rest a tooltip names
  it with its key ("Torba 23/60 — kliknij albo B: do obozu"). Over the field a dashed ring shows what a click
  would do: round David (hunt), on the spot (walk there), or a gold crosshair on the great stone's mark when it
  is ready (the cursor a crosshair).
* *Keys:* WASD and arrows walk, Space hunts / throws / buys, **B** the bag, **Q** the quest, 1–4 the camp's tabs.
  A mouse reads mouse words: the coach marks', the story cards', the how-to's (shorter, so the side column shows
  the goal, three rows and a tip) and the lamb's five lines that spoke of tapping.
* *Measured* (`scripts/arcade-mobile.mjs`): desktop, laptop, Full HD and QHD all ok, 0 strings under 13 px; the
  game's frame at QHD 1.08 ms (1.56 before: a tighter view draws less); the phones unchanged (small 3.83 ms at 4×,
  iPhone 1.67, on its side 1.92). Tests audit every `CHECK_SIZES` entry with a finger and with a mouse, check the
  zoom (≥ 78 px a u, ≥ 1.18 × the phone family's), the action bar and the frame, the font floor and the type's
  growth (median ≥ 1.7 × the phone's on QHD), hover, keys and the mouse's words.

#### Dziewiątka

Hero Wars on a monitor is a wide battle with the team along the bottom; ours kept
the phone's wide strip but under a thin street (Full HD: figures 120 px tall at the bottom of a 960 px column, 640
px of sky over them). With a mouse on a desktop or a big screen (`layout(…, touch)` → `desk`):
* *The street zooms in* the way an upright phone draws it: the figures larger than their spacing (×1.5 on Full HD
  and QHD: 120 / 160 px a u), the rows deeper, the houses of the band's history filling the back — no thin street
  under an empty sky. A desktop under the top HUD keeps its street (k = 1 where the band is short).
* *The strip grows with the screen* past the tablet's 124 px (130 on Full HD, 173 on QHD), and so does the type
  (`tk` = u / 1.3 lifts every capped size: labels, names, boons, story cards, Klara's bubble).
* *Keys on the cards:* 1–5 on the portraits, B on the bell, 1–3 on the boons (gold when they act now); a ready card
  says "Kliknij!" to a mouse.
* *Hover answers:* a portrait lifts with a violet frame and, after a moment, a tooltip names the hero, the role
  and the special with what it does; the bell says how full Harmony is (or "Kliknij albo B"); the dial says what
  the band drives. Over the street a dashed gold ring marks the portrait a click there would fire (the one that
  waited longest; the bell when Harmony is ready; at the well the hero a piece fits) — the tap that fires "the
  next ready" is no longer a guess. The cursor is a hand wherever a click acts.
* *Words for a mouse:* the coach marks (ult, bell, well, the street), the boons' hint ("1–3 albo Spacja"), the
  story card, the how-to (three rows and a short tip for the side column) and Klara's five lines about tapping.
* *Measured:* desktop, laptop, Full HD and QHD ok (1 string under 13 px, the "próg" tag, as before); the game's
  frame 1.0–1.1 ms on the big screens; the phones unchanged. Tests audit every size with a mouse too, check the
  zoom (figures ≥ 1.45 ×, rows ≥ 1.3 × the tablet street's), the strip's and the type's growth, hover, the aim
  ring (and that its click rings the bell), the font floor and Klara's mouse lines.

#### Nehemiasz

Nehemiasz already filled a big screen's band with the stretch of wall (Full HD
101 px a u, QHD 140) and kept one row under it; what a desktop lacked was a mouse's answers. With a mouse on a
desktop or a big screen (`layout(…, touch)` → `desk`, no other geometry change):
* *Hover answers:* a build badge under the mouse grows and raises **its cost card** (before the site Nehemiah
  stands on or the guide's pick) — a desktop player reads every price without clicking; the guide's button, "Na
  mur!", the horn and the choice cards light up; over the open field by day **the guide's pick wears a dashed gold
  ring** — a click there builds it. Tooltips name the stores ("Kamień: 40 z 130 — na mur", "Belki", "Chleb",
  "Ludzie 12 z 20 miejsc", "Siły 80 %") and say what a button does with its key. The cursor is a hand wherever a
  click acts.
* *Keys on the buttons:* the space bar's cap on "Następne" by day, on the horn when it is ready, else on "Na mur!";
  1–2 on the choice cards.
* *Words for a mouse:* the how-to's rows ("Kliknij znacznik albo „Następne”; nocą „Na mur!” albo róg") — shorter,
  so the side column shows them with a tip; the coach marks and the story card already had theirs.
* The controls' foot margin is min(10·u, 14) px (a QHD screen had opened a 27 px band under the button).
* *Measured:* desktop, laptop, Full HD and QHD ok (0 strings under 13 px), the game's frame ~1.0–1.1 ms; the phones
  unchanged. Tests check `desk` at every size, the unchanged geometry, hover (the guide's button and its tooltip,
  a badge, the stone store's numbers, the ringed guide's pick, the horn and "Na mur!" at night; none with a
  finger), the font floor with a mouse and the mouse's words in four languages.

#### Kocia straż

Kocia straż already had a desktop shape — the field on the left, a column on the
right — but on a monitor it was a phone's column: 27 % of the canvas, 60 px toy cells, then 400 px of empty brown
under the paw; the cats 84 px on a 770 px vineyard. With a mouse on a big screen (`layout(…, touch)` → `desk`):
* *The chest is what the hand works on:* the column is 36 % of the canvas (≤ 560·u), the cells 73 px on a Full HD
  monitor's middle column and 97 on a 2560 × 1440 one, the buttons taller with their key caps (1–4).
* *Brother Anselm moves beside the play:* his portrait and his bubble take the column's free room under the
  buttons — no empty band, and his words no longer cover the field's corner.
* *The cats, the pests and the wall grow with the screen* (`tk`: QHD's cats 116 px instead of 84).
* *Hover answers the merge:* a toy under the mouse glows with **its mates** — where a click would merge it — and
  the cursor offers to grab it (`grab`, `grabbing` while carried); a cat gets its ring and a tooltip with its gift;
  the buttons light up and name their key ("Kliknij albo 2: kup · przytrzymaj: kupuje dalej"); a pest under the
  mouse wears a crosshair — a click makes it the squad's target.
* *Words for a mouse:* the how-to (a short drag row, the click row, the keys, one tip), the coach marks for the
  upgrade, the target, petting and the hunt, the story card, and the brother's line about the eye.
* *Measured:* desktop, laptop, Full HD and QHD ok (0 strings under 13 px), the game's frame ≤ 1.1 ms; the phones as
  before. Tests audit every size with a mouse (1–6 cushions, the vintage, a story), check the column, the cells,
  the brother's corner, the cats' growth, hover (toy + tooltip, button + key, paw, pest crosshair; none with a
  finger), the font floor and the mouse's words.

#### Ogień, ogień, ogień

With a mouse on a desktop or a big screen (`screenKind` desktop / big, wide
— layout.ts `desk`) the fire is as large as the band allows: the ring's radius R = min(0.36 band, 0.25 width), up to
480 — 298 px in a Full HD monitor's middle column (was 226), 397 on a 2560 × 1440 one (was 260, the phone's cap) —
so the spark in the hands, the candle's window, the bonfire, the camp, the star and Pentecost fill the middle column.
The scale's button stands **beside the ring's lower right** and the bonfire's pile beside its lower left, where the
mouse already is, instead of in a phone's thumb corners; the cards stand over the ring's right half, the fire still
in sight; the words under the ring and Ignacy grow with u. **The mouse:** two arcs of warm light turn around what a
click would act on — the rules' own choice (`sim.hoverAt`): the spark to blow on, the candle to shelter, the bonfire
to poke, the dark tent the pillar would light, the pair that would fuse, the wisps within reach, the one waiting the
flame would pass to; over the button it lights and shows the button's target; the pile's rim brightens; the cursor
is a pointer wherever a click does something. Keys: Space or Enter do the scale's task (held at the candle, they
shelter it), listed in the left column. Words: "Kliknij scenę albo przycisk…", "Przeciągnij myszą polano…" and the
coach marks for tents, nuclei, the waiting, the pile and the button speak of clicks. Measured: desktop / laptop /
Full HD / QHD ✓, the game's frame 0.45–0.50 ms; the phone's layouts unchanged (small / iphone / side ✓).

#### Rozświetl

The dark mosaic already takes the band in its own proportions — 1130 × 837 px in a
Full HD monitor's middle column, 1507 × 1150 on a 2560 × 1440 one (92 % of the band), the firefly, its bubble, the
breath's word and the cards growing with u up to DESK_MAX — so the desktop pass is the mouse: **the tile a click
would act on answers it**, the rules' own choice (`sim.hoverAt`: the dark tile a click aims and knocks, the piece it
would gild while gazing, the nearest dark tile for a click on the light, where a ready flare would go off) — softly
lit with a rim of light over a dark edge, readable on a dark tile and on an uncovered bright piece, beside the aimed
tile's own pulsing edge; the cursor is a pointer on the mosaic and on a card. A drag moves the light with the mouse
as before (the lens without a finger's lift). Keys: Space knocks on the aimed tile or releases a ready flare (left
column). Words without a touch screen: "Kliknij kafel… kliknij znowu…", the coach marks "Kliknij kafel", "Klikaj
dalej albo naciskaj Spację", the warm-up's line in the panel "Kliknij kafel — światło napiera…", the album's "Kliknij
obraz w albumie…". Measured: desktop / laptop / Full HD / QHD ✓, the game's frame 0.24–0.55 ms; the phone's layouts
unchanged (small / iphone / side ✓).

#### Ja jestem…

With a mouse on a desktop or a big screen (`screenKind` desktop / big, wide —
layout.ts `desk`) the stained-glass window takes the band's full height (690 × 805 px in a Full HD monitor's middle
column, 949 × 1107 on a 2560 × 1440 one) and the picture's words — the declaration, the fragments with their parts
lit — stand in a column beside it at a reading measure (365 px at Full HD, 487 at QHD), the window and its column
centred as one group (the window keeps the canvas's middle, where a centre click lands); on a desk the words stand a
little above the window's middle instead of in the corner. Type grows with the screen there (`tu`): the
declaration 20 / 27 px, the fragments 18 / 23, Hanna's bubble, the captions in the glass, the opening card and its
small print — a phone's stop where they did. **The mouse:** the part a click would act on — the rules' own choice
(`sim.hoverAt`: where the colour would go, the glass that would glow in a rest, the part a rest would mark) — is
tinted warm with a rim of light over a dark edge, readable on the pale sketch and on lit glass; the card's answers
brighten under the mouse; the cursor is a pointer on the window and the card. A drag lays the colour's path as
before. Keys: Space a drop of colour, Enter closes the card (listed in the left column). Words: "Kliknij część
szkicu…", "Przeciągnij myszą po szkicu…" without a touch screen. Measured: desktop / laptop / Full HD / QHD ✓, the
game's frame 0.54–0.78 ms; the phone's layouts unchanged (small / iphone / side ✓, pixel-identical).

#### Odporność

A mouse on a desktop or a big screen gets the `desk` layout (layout.ts,
chosen from `screenKind`; a finger keeps every phone layout, the same numbers). **The world fills the field**: a
phone caps the slice of skin at 3.6 u per unit and lets the air take the rest of a tall screen, a desk lifts the
cap — a Full HD monitor's middle column shows the skin, the dermis and the venule 786 px high (was 613 under a
band of air), a QHD 1 080 px, so Makro, the neutrophils and the bacteria grow ~30 % while the world stays 185–190
units wide (a phone shows 130–150). Where the world leaves margins (a 1 280 window, a laptop) the burst and the
NET stand **right beside it, by the vessel's ends**, not in the middle of the margin; each carries its key's
cap (B, N). **The mouse:** whatever a click would act on is ringed and tagged with its name and what the click
does — a bacterium ("Ziarniaki ze skóry · oznaczona przeciwciałami · kliknij: obrońcy ruszą"; in the alarm
"kliknij: Makro ją połknie"), a rolling white cell ("kliknij: zatrzyma się i przeciśnie"), an infected or a
flagless cell of the nose ("limfocyt T" / "komórka NK"), a spent neutrophil ("Makro posprząta") — through the
sim's pure `aimAt`, the same choices as a tap; the cursor is a hand on targets and buttons, `grab` on the free
tissue (a drag leads the swarm; `grabbing` while it does) and a crosshair over the wound when a drag weaves
collagen. **Keys:** Space sends the swarm to the nearest bacterium (or lets the burst go when ready), B the
burst, N a NET (the how-to lists all three). The how-to, seven coach marks and Neo's lines say "kliknij /
przeciągnij myszą". **Measured:** desktop, laptop, Full HD, QHD ✓, 0 strings under 13 px, game ≤ 0.82 ms at QHD;
the phones as before.

#### Światło ciała

A mouse on a desktop or a big screen gets its own shape, `desk`
(layout.ts; chosen from `screenKind` and the width — an upright mouse window keeps `tall`, a finger keeps
every phone shape, the same numbers): the figure as tall as the band in the middle (1 190 × 960 at Full HD:
the figure 838 px, 87 % of the canvas; QHD 1 158 px), the scan's rail and lamp beside it. The **left column**
is the organ's live panel at the band's height — the value on its gauge, the range, what the body does — and,
on a desk only, **the loop's sources in full** ("Źródła: Osilla … 2023; Charkoudian … 2003; Haman …"; the rest
panel cites Russo 2017 and Lehrer & Gevirtz 2014). The **right column** is for what speaks: the sung line
and the next one at its top, the **Wiedza card at the band's height beside the panel** (a phone swaps the
panel for it; a desk keeps both — the band of light runs from the panel through the organ to its card), Zofia
at the end away from the band, and the **round button at its foot, by the figure's knees**, with the key's
name in a cap ("Spacja") under its caption. Type follows `uiScale` (1.3 on a laptop, 1.35 Full HD, 1.8
QHD) and the phone's fixed 12 px notes and chips grow with it (`L.k`). **The mouse:** the cursor is a hand
over what a click acts on (the body, the panel and its card, the button); a hovered organ is ringed in its
colour (both of a pair) with a tag — its name and its state with what a click does ("w świetle · kliknij, by
pomóc", "w równowadze · kliknij: Wiedza", "czeka na światło"); the tag fades when the mouse rests 3 s. **Keys:**
Space helps the organ in the light (on the beat at the heart, a breath's turn in rest), Enter opens and
closes the card; both are on screen (the button's cap, the panel's "Wiedza › Enter" chip). The how-to,
the coach marks, Zofia's lines about the hands and the lobby's rules say "kliknij / click / klicke / klicka".
**Measured** (scripts/arcade-mobile.mjs): desktop, laptop, Full HD, QHD ✓ — 0 strings under 13 px (before:
6 at 12 px), game 0.6–0.73 ms; the phones as before (small, iPhone, side ✓, the same counts).

#### Synapsy

A mouse on a desktop or a big screen gets the `desk` mode (layout.ts,
chosen from `screenKind` and a landscape band; a finger and an upright window keep the phone's `tall`/`side`,
identical). **The brain is as tall as the band** — 842 px in a Full HD monitor's middle column and 1 133 px on
QHD (the old side layout: 673 / 897), so neurons stand 99 px apart for the mouse — and the HUD takes columns
beside it: on a wide, short band (a laptop, a 1 280 window under the top HUD) the brain stands in the middle with
the **lens and the lesson/Wiedza cards** on its left and the **song, Oli's words and Oli** on its right; on a big
screen's middle column the full-height brain leaves one column on its right — the lens at the top, the cards
(their sources whole, e.g. "Engel et al. 1991 · Science 252:1177"), Oli's words, the sung line and the next one,
and **Oli at the foot, right by the brain**, the O key's cap under her nest. Every size the phone capped at
1.15–1.2 (IO labels, the m/s plate, the halves' plate, the bubble, the lens's word, the story) grows with
`uiScale` (`typeK`). **The mouse:** a neuron under the cursor is ringed and named with its region and where it is
("Wzrok · L — płaty potyliczne, z tyłu głowy") and what a click does now ("kliknij, potem sąsiada", "kliknij:
połączą się", "kliknij: połączenie zgrubieje", "za daleko — połącz przez sąsiada"), with a dashed line from the
neuron fired a moment ago, gold when they can wire; a grown link under the cursor glows and **shows its real
numbers** — synapses, length (mm of a 167 mm brain), speed (m/s from its myelin), the time across (ms), myelin
%. The cursor is a hand on neurons, links and Oli, a crosshair on free tissue (a click there wires the nearest
pair), an arrow elsewhere; tags fade when the mouse rests. **Keys:** Space (or Enter) wires the pair the lesson
needs next, O sends Oli (her key cap). Mouse words in the how-to, the coach marks and Oli's lines. **Measured:**
desktop, laptop, Full HD, QHD ✓, ≤ 2 strings under 13 px (before 5), game ≤ 0.9 ms; phones as before.

#### Odnowa

A desk (round 11): the lens up to 0.22 of the width (262 px of radius in a Full HD middle column); hover answers —
the turbine („Turbina komórki (syntaza ATP) · 8 protonów = 1 obrót = 3 ATP · kręci się, gdy się skupiasz”), Mito
(„kliknij: co teraz robić?”), a need of the goal (its source and count), a worn part („sprzątanie komórki (autofagia)
· w spokoju zamienia się w budulec”), the lesion a click on the lane would mend (its name and the crew's steps ·
„kliknij: napraw”); the cursor is a hand on Mito and on damage. Space or Enter mend the damage waiting longest. A
Wiedza card shows whole with its source.

#### Rzeki żywej wody

A desktop or a big screen with a mouse (`screenKind` desktop / big, wide)
gets its own layout (layout.ts `desk`): the figure of light as tall as the band allows — 82 % of the Full HD
middle column's band (H 711 px), 980 px on a 2560 × 1440 monitor — with room above the head for the crown's open
window (it no longer slips under the bar), and the words in a column beside it at a reading measure (~34
characters of the prayer, 425 px at Full HD, 561 at QHD), the figure's egg of light and the column centred as one
group. The words **stand level with the place the light is at** (`wordsAt`): the place's name on the band's first
row at the window's height, the prayer under it in balanced lines (no orphan word), the narrator above; they glide
with the stream of living water to the next place, rest at the chest when the whole body is lit, and wait under
the runner's banner in a block's first seconds. Type grows with the screen: the prayer 18.5u (24 px desktop, 25
Full HD, 33 QHD), the verse 16.5u — and the rest verse is no longer always 13 px (a passage ending with its own "…"
was taken for a cut one; fixed for every screen). **The mouse:** a click anywhere stays with the place, so the
cursor is a pointer over the play; two arcs of light turn around the place a click would stay with (the next one
while the stream flows), brighter over the figure, fading once the mouse rests — a meditation, not a cursor chase;
a story card brightens under the mouse. Keys: Space stays with the place, Enter turns a card (listed in the
left column); the how-to says "Kliknij — zostań przy miejscu…", the keys "to samo co kliknięcie". Measured: audit
desktop / laptop / Full HD / QHD ✓, no string under 13 px, the game's frame 0.57–0.66 ms (QHD 0.57); the phone's
layouts unchanged (small / iphone / side ✓). Since round 11 the map column stands left of the outer shell; the group — column, shell, egg, words — is centred.

### 14.6 The registry's lines for a mouse (`i18n/arcade-mouse.ts`)

A game's card text, its lobby's three lines and its calibration tips are written for a finger ("stuknij",
"przesuń palcem"): most players hold a phone.  At a desktop those words mislead, so a line that names a
finger's gesture has a twin with the same key in `i18n/arcade-mouse.ts` — the click, and the key where the
game has one, as the game's own how-to names them ("Kliknij albo Spacja — skok").  `forHands(entry, touch)`
(registry) gives the lines for the hands that play; the Gry cards and the lobby ask `coarsePointer()`, the
calibration card and the how-to the runner's `touch`.  A line that names both ("stuknij lub kliknij") needs
no twin.  `test/arcade-mouse.test.ts` holds the twins to the registry's keys and order, keeps every finger's
word out of them in all four languages, and fails when a registry line names a finger's gesture without a
twin — so a new game cannot forget its desktop words.

## 15. Health visualisations: guided meditations to choose, walk through and repeat (2026-11-17)

The founder's note of 2026-11-17 headed one of its items *"Wizualizacje zdrowotne"* (health visualisations). The
Games tab has a section of that name now (registry `kind: 'health'`, between the visualisations and the body
series; its note: guided meditations to choose, move on or repeat; attention and imagination training, not a
treatment). Unlike the body series' games, a health visualisation is a **library of meditations** — the player
chooses one, walks through its scenes, goes back, repeats a scene or the whole meditation, and the next session
goes on where this one stopped — and, as in Rzeki this round, its pictures grow **only from real focus**.

### 15.1 Każdy włos — every hair numbered (the founder's request of 2026-11-17)

The founder wrote: *"Wizualizacje zdrowotne. Dodać wizualizacje wzrastania włosów, regeneracji głowy, zgodne z tym jak
odbywa się wzrost włosów na głowie. Chcę móc wybierać, nawigować lub powtarzać różne medytacje w tym zakresie"* —
visualisations of hair growing and of the head regenerating, true to how hair really grows, meditations to choose,
navigate and repeat — with a free hand.  The game is the first of the Games tab's new section **Wizualizacje
zdrowotne** (registry `kind: 'health'`), rooted in **Luke 12:7** ("even the very hairs of your head are all numbered;
do not be afraid"): God's care for every hair, never a promise that hair will grow.  Code: `src/arcade/wlosy/`
(sim.ts the session, render.ts the view, the five pictures in world-*.ts).

**One line:** a library of eight short guided meditations about the hair and the scalp; in each, the player's real
concentration makes the picture grow — scene by scene, true to the physiology — while rest deepens it with the breath.

### 15.2 The physiology (every number on screen, and its source)

| What the game says | Source |
|---|---|
| About 100 000 hairs on a head (most adults 80 000–120 000) | Oh et al., J Invest Dermatol 2016;136:34 (PMID 26763421); StatPearls "Anatomy, Hair" (NBK513312) |
| Follicular units of 1–4 hairs, about 2 a unit; 60–100 units per cm² (the 124–200 hairs and 65–85 units/cm² of the brief were measured at the back of the scalp, so the game says the range) | Jimenez & Ruifernández, Dermatol Surg 1999;25:294 (PMID 10417585); Bao et al., J Craniofac Surg 2018 (PMID 30277939); Ortega-Castillejos & Pathomvanich, Dermatol Surg 2017 (PMID 28362669); the term: Headington, Arch Dermatol 1984 (PMID 6703750) |
| About 0.35 mm a day, about a centimetre a month | StatPearls "Anatomy, Hair"; Loussouarn, Br J Dermatol 2001;145:294 (PMID 11531795: ≈ 0.40 mm/day Caucasian, 0.26 African hair) |
| Only the root grows; the cells harden about a millimetre above the bulb (keratogenous zone) | StatPearls "Physiology, Hair" (NBK499948); Jones et al., Br J Dermatol 2018 (PMID 29181849) |
| Matrix cells divide about every 39 h, ≈ 8× faster than basal cells of ordinary skin (311 h) | Weinstein & Mooney, J Invest Dermatol 1980 (PMID 7351493); Weinstein et al. 1984 (PMID 6725985) |
| Anagen 2–7 years (85–90 %), catagen 2–3 weeks, telogen about 3 months (10–15 %), exogen an active release; 50–100 hairs a day is normal | Oh et al. 2016; StatPearls "Anatomy, Hair Follicle" (NBK470321); American Academy of Dermatology, "Hair loss or hair shedding?" |
| Each follicle keeps its own time (a mosaic) | Oh et al. 2016 ("mosaic, stochastically driven"); Halloy et al., PNAS 2000 (PMC26947) |
| Catagen: the lower follicle regresses, a club hair forms, the papilla rises to the bulge | StatPearls NBK470321; Schneider, Schmidt-Ullrich & Paus, Curr Biol 2009 (PMID 19211055) |
| Papilla signals wake the hair germ and the bulge's stem cells; a new hair grows from below; the old one is let go (sometimes before the new arrives — never shown as "pushed out") | Greco et al., Cell Stem Cell 2009 (PMC2668200); Oh et al. 2016 |
| The follicle a mini-organ that rebuilds its lower part in every cycle, through life | Schneider et al. 2009; Stenn & Paus, Physiol Rev 2001 (PMID 11152763) |
| The papilla: specialised fibroblasts, a capillary loop, signals to the matrix; bigger papilla, thicker hair | StatPearls NBK499948; Elliott et al., J Invest Dermatol 1999 (PMID 10594724) |
| Eumelanin black–brown, pheomelanin yellow–red; pigment made only in anagen; grey and white: fewer active pigment cells | Slominski et al. 2005 (PMC1201498); Ito & Wakamatsu 2011 (PMID 22077870); Commo et al. 2004 (PMID 15030325); Nishimura et al., Science 2005 (PMID 15618488) |
| Cuticle 5–10 layers of flat overlapping scales, cortex the bulk, medulla only in thick hairs | Swift, J Cosmet Sci 1999;50:23; Wolfram, J Am Acad Dermatol 2003 (PMID 12789162) |
| The bulge at the arrector pili's insertion, below the gland; sebum oils hair and skin | StatPearls NBK470321; Cotsarelis et al., Cell 1990 (PMID 2364430); Ohyama et al., J Clin Invest 2006 (PMC1323261) |
| Bulge cells help mend wounded skin (they do not renew it day to day: the basal cells do) | Ito et al., Nat Med 2005;11:1351 (PMID 16288281, in mice) |
| Hair leaves the skin on a slant — about 16° at the temple's hairline | Mowlavi et al., Plast Reconstr Surg 2007 (PMID 17440370); Gharwade, Indian J Plast Surg 2016 (PMC5288916) |
| The scalp's five layers (S·C·A·L·P), the galea pulled by the frontal and occipital bellies; five pairs of arteries (supratrochlear, supraorbital, superficial temporal, posterior auricular, occipital) richly joined | StatPearls "Anatomy, Head and Neck, Scalp" (NBK551565; its arterial section has slips — not copied); Karsidag et al., J Craniofac Surg 2009 (PMID 19934684) |
| The epidermis: basal cells divide, rise, flatten and flake off in about six weeks in ordinary skin; the scalp a little faster (the popular "28 days" has no primary source) | Weinstein et al. 1984; Iizuka, J Dermatol Sci 1994 (PMID 7865480) |
| One crown whorl in > 95 % of people, clockwise in most groups studied (≈ 3 in 4 to 9 in 10; Japan 50:50), often a little to the right | Klar, Genetics 2003 (PMC1462764); Schmidt et al. 2008 (PMC5848856); Samlaska et al., Arch Dermatol 1989 (PMID 2642687) |

Not shown: the per-colour hair counts (blond 150 000 …) — no traceable source.  A research pass (PubMed, StatPearls)
checked every line; the brief's "28 days", "124–200/cm²", "a single exit angle" were corrected.

### 15.3 The library

| # | Meditation | Scenes (each grows with focus) | Picture | Verse |
|---|---|---|---|---|
| 1 | Ciepło i krążenie | the galea and the two bellies of the occipitofrontalis soften · the five arteries fill one after another, then their joins over the crown · the five layers named, the capillary net grows from the deep arteries up to a loop in every papilla | head in profile ×2, section | Ps 23:5 |
| 2 | Korzeń | the papilla lights cell by cell · its capillary loop fills, blood cells flowing · signals pulse from the papilla to the matrix | follicle (bulb) | Ps 1:3 |
| 3 | Kolor | melanocytes wake on the papilla's top, dendrites reaching · granules of eumelanin and pheomelanin pass into the new cells (the player's colour; grey: few active cells) · the colour rises from the bulb to the tip | follicle (bulb, whole) | Ps 139:13–14 |
| 4 | Wzrost | matrix cells divide, one into two · cells rise and harden: the gold front of keratin, cuticle scales, cortex, medulla · the hair leaves the skin on its slant, a ruler of days beside it | follicle (bulb, mid, top) | Mark 4:27–28 |
| 5 | Wir i kierunek | strands rise around the crown's clockwise whorl · streams of light: forward, sideways, down the nape · a square centimetre close up: 80 units open one by one (≈ 170 hairs) | head from above, skin | Luke 12:7 |
| 6 | Cykl odnowy | anagen (a dial of the cycle's true shares) · catagen into telogen (the club hair, the papilla rising) · a new hair from below, the old one let go · each follicle in its own time (a mosaic of eleven, a legend of the phases) | follicle (whole), section | Eccl 3:1 |
| 7 | Odnowa skóry głowy | the epidermis renews: cells born at the base rise, flatten, flake away (the newborn rimmed in gold) · the sebaceous gland fills and oils the hair · the barrier built as bricks and golden mortar; the bulge's stem cells | section (epidermis), follicle (top) | Ps 103:5 |
| 8 | Cała głowa | warmth (all five arteries at once) · the roots (every papilla lit) · growth (every hair out of the skin) · the head held high (the hair grows to its length in the player's colour, the head lifts) | head, section ×2, head | Ps 3:3 |

Each scene has a name, a line it teaches in the words band (plain physiology with the real numbers), a picture for
the head in a push (the runner's "W głowie": the scene's own imagery; every third push a counting one — "add up the
hairs in the tufts"), one narrator line, and the parts it names on the picture in a small italic serif.

### 15.4 The pictures (beauty first)

A luminous medical plate in the body series' family, drawn in code: a deep plum ground; **tissues that glow from
within** — dark rose-plum dermis with faint collagen glints, translucent sheaths with bright rims, the bulb lit from
inside around a magenta papilla, gold for growth (the keratogenous front, the sparks of the growing point), warm red for
blood, aqua for stem cells, honey for sebum.  Five worlds (geo.ts): the head in profile (no features but the line of the
face; the galea, the bellies, the five arteries; the hair as a cap over the side of the head above the ear, strands
flowing from the crown with a curved temple hairline), the head from above (a clockwise whorl behind the middle, the
strands lying on the head and ending at its edge), a square centimetre of skin, the scalp in section (S·C·A·L·P over
the bone, eleven slanted follicles reaching into the fat, more beyond for a wide box), one follicle in detail (slanted
24°: CTS, ORS with the bulge, IRS to the isthmus, the hair with cuticle/cortex/medulla, the bulb with matrix,
melanocytes and papilla with its loop, the gland of three lobes, the arrector pili on the obtuse side).  The tissue
worlds are seen through a lens (a rounded plate with a rim of light and an inner vignette).

**The camera** frames each scene's view; within a picture it glides (bulb → mid → whole), between pictures it dives:
deeper (head → section → follicle) it zooms into the place it came from while the next picture opens from there,
shallower it pulls out — the "zoom from the head down into one follicle".  Reduced motion: a cross-fade.

**The gauge on the picture:** at the growing point a halo whose edge follows the light, the threshold as a faint dashed
ring in a sighted push, gold once past it, sparkles while it grows; rest: a soft glow breathing 4/6; blind: nothing.

Performance: the ground and every picture's still parts are baked per view and size; many strands (the head from above,
the profile hair) are drawn into layers that grow incrementally / are redrawn only when their length moves a step.

### 15.5 Progress only from real focus

The founder's rule of the round: a scene grows only in a **sighted push past its lead-in** (5 s Mendi, 2 s HALO), with
a **reliable** signal, while **`frame.focused`**: `(0.75 + 0.5·level + 0.25·min(1, hold/20)) / 30` of the scene a second
— 21–25 s of focused time in strong focus, 25–29 s at a moderate one, 28–32 s at the threshold.  The first-ever
session's warm-up grows at half that rate (it is real focus too; it lets the smoke score early).  Rest, the finale, the
lead-in, a story card, no signal: nothing grows and nothing is lost.  Rest **deepens** the picture instead (warmth,
colour, sheen follow calm, τ 3 s, fading slowly after).  A blind push grows unseen (up to 0.6 past the scene's end,
carried into the next) and shows it at its end, with its hairs.  Measured with the sim (300 s of a 10-minute session,
rests calm): about one scene per two push blocks at a moderate signal; **none without focus** (0 scenes, 0 hairs).

### 15.6 Choose, walk, repeat

* **Modes** (the lobby's card and the picker): **Po kolei** — all eight in order, round again; **Jedna** — the chosen
  meditation once, then its last picture stays ("after": the hair keeps growing — focus still counts hairs, a sheen);
  **Powtarzaj** — the chosen meditation again and again.
* **In play:** four round controls — **≡** the picker, **◀** the previous scene, **↻** this scene again from its start,
  **▶** the next — across meditations and round the eight.  A scene walked back to shows as it was left this session.
  Skipping is the player's; only scenes grown by focus count as grown.  A tap on the picture stays with it (its words
  glow again); Space does the same.  Keys: ← → R M, 1–8 in the picker; hover answers on a desk (a brighter control, its
  name above it; pointer cursor).
* **The picker:** a card over the dimmed picture — the three modes as segments, the eight meditations as tiles (the
  current one gold; scenes grown, a check once completed; numbered 1–8 on a desk); a step along the scenes, a closing
  card or 20 s untouched closes it; long names wrap onto two lines.
* **Resume:** the place is saved (the scene and its growth; a grown scene hands on to the next, at a meditation's end by
  the mode) and the next session begins there.  The lobby's card says where ("Wznowisz: Korzeń · scena 2/3 — Pętla
  naczyń") and choosing a meditation there starts it at its first scene (or resumes it, if it is the one in progress);
  each tile is the meditation's picture with its name and "✓ n×" once completed (or its scenes grown so far).

### 15.7 The headline, the colour, the words

* **Hairs** (włos / włosy / włosów; hair/hairs; Haar/Haare; hårstrå/hårstrån): 4 a second of focused growth at a
  multiplier of 1 (≈ 120 a scene); nothing for rest, nothing for verdicts.  A floating "+N" every 2 s by the growing
  point.  The lifetime total ("Policzone włosy") in the card.  A 5-minute session at a moderate signal: a few hundred.
* **The hair colour** (black, dark brown, brown, auburn, blond, grey/white) in the card: every strand, the melanocytes
  and their granules take it (eumelanin's share by colour; grey has few active pigment cells — the narrator says so,
  "and it is numbered just the same").  Strands carry a sheen so dark hair reads on the dark ground.
* **Words:** the band under the picture (the scene's name and its meditation · n/of, then what it teaches in a serif,
  pages of whole lines that turn slowly when it does not fit; rest: the breath's count and the meditation's verse); the
  narrator (≤ 90 characters, at most one line, never over a banner, a card, the picker or a coach mark) speaks in the
  band's top row on a phone and in its own place on a desk.  Story cards: the first session's two pages (Luke 12:7; then
  "what this is: visualisation and attention training, not a treatment; sudden or patchy hair loss — a dermatologist"),
  and a closing card for each meditation (its verse, "Dziękuję za każdy włos", what comes next by the mode).
* **Not a treatment** appears plainly in the card, the opening card, the registry tip and the how-to's last tip ("the
  band measures attention, not the health of your hair").  No disease named as a target; no promise of regrowth (a
  test keeps such words out of all four languages).

### 15.8 Sound, blocks, summary

A quiet original tune in F major at 56 bpm (tune.ts on kit/song.ts: soft chords always, bass, a bell melody, a harp of
arpeggios at full growth; the layers follow the light in a sighted push, a gentle level in rest, held in a blind block;
switch in the card); without it a warm pad.  A bell per meditation on the pentatonic ladder, a glass tone each tenth of
a scene grown, a chime for a grown scene, all eight bells for a whole meditation, the breath's wind in rest, a page-turn
for a step.  Blocks as the reference game: push 24 ± 3 s, rest 26 ± 3 s, telegraph 4 s, judged once over the last 15 s
(`RoundJudge.from(env.tuning)`, `BlockContrast`), every 4th push blind from the 3rd session, a warm-up the first time, a
quiet finale (the picture settles).  Summary: scenes grown, meditations completed, growth from focus (s), calm, the
longest calm, focus − rest; highlights (a completed meditation, the scenes grown, the record or how far, the longest
calm, the dark's share, all numbered so far, where the next session begins); the closing verse in turn: Luke 12:7 the
first time, the meditation's verse, 2 Cor 4:16, Ps 139:16, Isa 40:31, Ps 121:1–2.

### 15.9 Reverence

No figure of God, no cross, no Spirit drawn; the verses come only from scripture.ts.  The narrator thanks ("Dziękuję za
każdy włos") and never promises.  The head in profile has no features but its outline (anyone can see themselves).

### 15.10 Mobile first, and the desk

layout.ts, pure, tested at every `CHECK_SIZES` entry (targets audited for the controls, the picker's 12 parts and the
story card; the controls never at the canvas's middle).  *tall*: the picture in the middle, the words band (≥ 104 px)
over the four 48 px controls in the thumb zone; *side*: the picture square on the left, the words and the controls in a
column; *wide* (a tablet on its side) the same grown; *desk* (a mouse on a desktop or a big screen): the picture as tall
as the band and as wide as the column leaves, the narrator, the words and the controls with their key caps in a column
at a reading measure (17 × the teaching size), centred as one group; type grows with `uiScale`.  The picture: 344 × 178
on the smallest phone (words band 328 × 110, buttons 48), 374 × 223 in iPhone Safari, 374 × 369 installed, 396 × 301 on
a large phone, 280 × 280 on its side, 804 × 521 on a tablet, 456 × 456 on a 1280 desktop, 701 × 838 in a Full HD
column (teaching text 24 px), 946 × 1158 on QHD (32 px, buttons 87).  Text: teaching ≥ 15 px, labels, captions, the
breath and the cards ≥ 13, a verse's reference 11 (the kit's).  Long names wrap rather than shrink under 13 px (the
picker's "Der Reihe / nach", "Der Kreislauf / der Erneuerung", a closing card's title on two lines).

**Measured** (scripts/arcade-mobile.mjs, final run): small phone, iPhone, phone on its side ✓ — 0 strings under 11 px,
only the kit's verse references at 11 px under 13, 18 targets (the four controls, the picker's 12 parts, the story
card) all valid, 60 fps with the CPU slowed 2–4×, game 0.79–2.03 ms (the latter at 4×); desktop, laptop, Full HD, QHD
✓ — 0 under 11 px, game 1.01–1.11 ms (QHD 1.1 ms), the picture 90 % of the screen's height on Full HD and QHD.
Tests: test/arcade-wlosy.test.ts (55); the whole suite green.

## 16. Round 11: the founder plays the games (2026-11-17)

The founder played the visualisation games and wrote back the same day, in Polish, game by game. Most of it is
**clarity** — three games (Odporność, Odnowa, Wzlot) left them unsure what was happening, what to do or when — and a
few concrete asks: a configurable breath, rests that follow the player's progress instead of a clock, own pictures in
every popular format, more pieces in the mosaics, and variants of the body scan. Round 10 (§13.14 "Round 10", §15) is
part of the same branch and had not been deployed when the founder played, so some of the answers were already in it.

### 16.1 What the lead built for this round

* **`kit/breath.ts`** — a breath of four phases, each **0–15 whole seconds**: in, hold (full), out, hold (empty)
  (*"Chcę żeby oddech można było konfigurować od 0 do 15 sekund wdech, wstrzymanie powietrza, wydech, wstrzymanie
  bezdechu"*). A phase of 0 s is skipped; a cycle under 2 s guides nothing, so a saved pattern like that falls back to
  the default **4 · 0 · 6 · 0** (in 4, out 6: six breaths a minute, the games' guide since round 4). `breathAt(p, t)`
  gives the phase, how far through it, the seconds left and the lungs' fullness (eased in and out, still on a hold);
  presets name the common patterns (4·6 calm, 5·5 even, 4·4·4·4 box, 4·7·8 relaxing). **A rest is a whole number of
  breaths** (*"Faza odpoczynku powinna być wielokrotnością sekcji oddechowej"*): `breathRest(p, target, min)` takes the
  nearest whole number of cycles to the target, never fewer than the minimum needs (a rest must be long enough to be
  judged), never none; `breathRestOf(p, n)` takes the player's own count. A rest begins with the pattern's first phase
  and ends exactly at a cycle's end. Pure (no DOM, no words); tests in `test/arcade-breath.test.ts`.
* **`kit/images.ts`** — own pictures in **every popular format** (*"…w formacie .jpeg, .jpg, .png i innych
  popularnych"*): the pickers offer `image/*` and the formats by name (JPEG/JFIF, PNG, WebP, GIF, BMP, AVIF, HEIC/HEIF,
  TIFF, SVG — a desktop's dialog filters by extension); a picture is turned upright by its EXIF, resized to 1280 px,
  laid on white where it was transparent (a PNG's transparency would turn black as a JPEG) and kept as a JPEG on this
  device only. A desktop may **drop** a picture on the card or **paste** a copied one (`imageDrop`). What cannot be
  kept says why (`ImageError.reason`: not a picture, an iPhone's **HEIC outside Safari**, a format the browser cannot
  read, over 60 MB, storage refused), each game in its own words. HEIC: Safari decodes it; Chrome, Firefox and Edge do
  not, and the only decoder library (libheif in WebAssembly) is LGPL-3 and 26 MB, so the player is told to open it in
  Safari or save it as JPG/PNG (an iPhone's own picker already converts to JPEG). Labels hold up to **100 characters**
  (an own affirmation, *"żeby afirmacje mogły mieć do 100 znaków"*).
* **The clarity rules** every game of the round follows: a caption stays ≥ 2.5 s + 70 ms a character and never under
  4.5 s (*"Napisy i tłumaczenia zbyt szybko znikają"*); one persistent "what to do now" line per phase; each control
  taught the first time it matters, with the gesture drawn; each technical term glossed in plain words the first time.
