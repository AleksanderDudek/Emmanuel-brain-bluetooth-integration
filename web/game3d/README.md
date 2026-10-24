# HolyHolyHoly 3D: Archaniołowie — a GDevelop game

A 3D browser game built with [GDevelop](https://gdevelop.io)
([source](https://github.com/4ian/GDevelop)), a reinterpretation of
[HolyHolyHoly](../game/DESIGN.md). You play one of the seven archangels of the Eastern
tradition, guardian of a person in today's Poland (a man or a woman, named by the player).
Their wounds have become shadow-thoughts that whisper lies; broken, each leaves a true
sentence behind. A chapter is three stages of one day or night of the person (a clock runs,
the light changes); memories found on the map tell the story, and some shadows speak the
person's thoughts aloud: silenced, they show how the thought lies and what is true instead.
At the end the chapter's lie comes in its own figure (Dread, the Heart of Stone, Semblance…).
Then Christ comes in a healing scene, in His own words from the Gospel, and the person
works through the lie and takes one real skill into life (from CBT and ACT).

The play mixes Archero (the archangel's gift acts while you stand still), survivors-likes and
Heroes vs Hordes (stages, gift and virtue cards with slots, evolutions, reliquaries, a hero
with his own prayer) and Endless Puncher (strike combos). Healing comes from springs of
living water, words of truth and a breath (hold Q while standing still). The Mendi fNIRS band is optional.
The game is in Polish; the design document, also in Polish, is [DESIGN.md](DESIGN.md). It is a
game, not therapy: help lines are in the game where they matter.

```bash
cd web
npm ci
npm run dev:game3d     # check + export, then http://localhost:5175
npm run build          # Emmanuel, HolyHolyHoly and this game → dist/, dist/holyholyholy3d/
```

## Where things come from

| What | Source of truth | Built by |
|---|---|---|
| Scenes, events, objects, the project's own extensions | `generator/*.mjs` | `npm run game3d:generate` (writes `project/`) |
| Story, chapters, archangels, gifts, shadow-thoughts, thinking errors | `tools/story.mjs`, `tools/game-data.mjs` | `npm run game3d:content` (writes `assets/data/content.json`) |
| Verses only the 3D game quotes | `tools/fetch-verses.py` (Gdańsk Bible, public domain, verified against Wikisource) | writes `tools/bible.mjs` |
| Paintings (figures, icons, story panels, floors) | `art/manifest.json` (prompts) + `art/lock.json` (chosen originals) | `npm run game3d:art` (local model, see below) |
| Billboard and effect models | the paintings + `tools/billboard.mjs` | `npm run game3d:billboards` |
| Low-poly props, UI images, fonts | `tools/build-models.mjs`, `build-textures.mjs`, `build-fonts.py` | `npm run game3d:assets`, `game3d:fonts` |
| Music and the focus band | `src/psalm150.ts`, `src/mendi-focus.ts` | `npm run game3d:libs` (writes `lib/*.js`) |

**The generator is the source of truth for the project.** It builds every scene with
GDevelop's own core library (libGD.js), checks each action, condition and expression against
GDevelop's metadata, and exports. You can open `project/HolyHolyHoly3D.json` in the GDevelop
editor to look around, preview and experiment, but lasting changes go into `generator/`
(otherwise the next `game3d:generate` overwrites them).

## The project

```text
project/
├── HolyHolyHoly3D.json        ← open this in GDevelop (5.6.269 or newer)
├── layouts/                   scenes: title, ladder, synaxis, story, arena, revelation
├── externalEvents/ui.json     the UI events every scene links to
├── eventsFunctionsExtensions/ HolyHoly, Psalm150, MendiFocus + official extensions
├── assets/                    heroes, enemies, bosses, christ, people, props, skills, story,
│                              models, textures, ui, particles, fonts, data/content.json
└── lib/                       psalm150.js, mendi-focus.js (built)
```

| Scene | Role |
|---|---|
| `Title` | menu; who you protect (gender, name); how to play; Mendi band; settings; help and safety; support |
| `Ladder` | the map (St John Climacus' Ladder); Fruits of the Spirit; Book of Truth (lies and thoughts); toolbox with guided breathing |
| `Synaxis` | choosing the archangel (one trial for locked ones) |
| `Story` | story scenes over painted panels: prologue, a chapter's intro (with a content note and skip), its healing scene |
| `Arena` | the fight: three timed stages with memories and voices, springs and the breath, gifts, virtues, evolutions, reliquaries, the archangel's prayer, the recognition card, the lie in its own figure, praise, falling and rising, pause, HUD |
| `Revelation` | the thought record, the truth, the tool for life, the report and rewards, the finale |

How the events are organised:

* **Groups and comments.** Each scene's events are grouped by system, and each group starts
  with a comment that explains its rules.
* **Balance in one place.** All numbers live in the global structure `Tuning`.
* **Content as data.** Everything the story says comes from `assets/data/content.json`,
  loaded into the global `Content`. Texts hold the man's and the woman's forms
  (`{kochany|kochana}`) and the person's name (`{imie}`); `HolyHoly::G()` resolves them.
  Progress is in the global `Save` (`localStorage`, merged over the defaults).
* **UI.** Global objects (`UiPanel`, `UiButton` + `UiLabel`, `UiText`, `UiArt` with every
  painting as an animation…) are made by `HolyHoly::MakeButton`, `MakeText`, `MakePanel`.
  Every UI object carries `Panel` (to delete a panel at once) and `Key` (to update a text). A
  click on a button of the top panel (`Ui.top`) puts its `Action` into `Ui.clicked` for one
  frame.
* **Data-heavy rules in JavaScript helpers.** Drawing gift cards (slots, evolutions),
  taking a gift, drawing a voice, the stage clock, loading a story scene: `HolyHoly::DrawChoices`,
  `TakeSkill`, `DrawVoice`, `StageClock`, `LoadScene` (see `generator/ext.mjs`).
* **Text always fits.** `HolyHoly::MakeText` takes a maximum height (the `h` option of
  `label()` in `generator/ui.mjs`): a text that would run taller is set smaller, a point at a
  time, down to 60 %. Cards lay their lines out in flow (each line starts under the last one,
  from its real height), and panels narrow with the screen (16:9, 16:10, 4:3).
* **Painted figures** are `Model3D` billboards: a cut-out painting standing on a quad with a
  soft shadow and a breathing idle animation. The object's depth (Z size) compensates for the
  camera's angle, its height (Y size) is the hitbox depth.

## Paintings: a local pipeline

`tools/art.py` paints everything with an open model on the machine (DreamShaper XL Lightning,
SDXL, with the fp16-fixed VAE; Apple Silicon or CUDA), cuts figures out with BiRefNet
(rembg), frames portraits and icons, and writes WebP/JPG into `project/assets`. No API key,
no cost. Every original goes to `~/generations` (flat, with a JSON sidecar: model, prompt,
seed, parameters) and the chosen one per id is pinned in `art/lock.json`, so the game files
can always be rebuilt from the originals.

```bash
python3 -m venv ~/gdtools/art/venv && ~/gdtools/art/venv/bin/pip install torch diffusers transformers rembg pillow
ART_PYTHON=~/gdtools/art/venv/bin/python npm run game3d:art   # paint what is new or changed (≈35 s an image on an M-series Mac), then process
npm run game3d:billboards     # billboards and effect models from the paintings
```

Prompts stay under CLIP's 77 tokens (`art.py` warns otherwise). To repaint one image, change
its prompt or its `seed` in the manifest; `"keep": true` pins the chosen original even when the
prompt changes (when an earlier painting was the best one). The figures of Christ follow icon conventions (the
cruciform halo is His alone); a human icon painter should eventually repaint them.

## Extensions

| Extension | What it is |
|---|---|
| `HolyHoly` | this game's helpers: content, save, 3D→screen projection, gendered texts, gift draws, story scenes, voices, the stage clock, device checks, UI builders (with text fitting) |
| `Psalm150` | the "Psalm 150" soundtrack and effects: `lib/psalm150.js`, bundled from `../game/src/audio` |
| `MendiFocus` | focus and the optional Mendi band: `lib/mendi-focus.js`, bundled from the app's Web Bluetooth adapter and fNIRS pipeline |
| `FireBullet`, `SpriteMultitouchJoystick`, `ParticleEmitter3D`, `ShakeObject3D` | official extensions from GDevelop's extension store |

## Toolchain: GDevelop without the editor

`tools/gdevelop.mjs` drives GDevelop's core (the pinned npm package `gdcore-tools`, GDevelop
5.6.269). It validates the events (each instruction exists with the right parameters; yes/no
parameters are literals; each expression parses and resolves objects, behaviors, variables and
functions), exports the HTML5 game and collects GDevelop's diagnostics. After the export it
removes the Draco `.wasm` from the page's scripts (a 5.6.269 quirk) and adds a `<title>`,
`lang="pl"`, a favicon and a description.

| Script | Does |
|---|---|
| `npm run game3d:check` | libraries and content up to date, `project/` exactly what `generator/` makes, project valid (no output files) |
| `npm run game3d:generate` | rebuild the project from `generator/` |
| `npm run game3d:export` | export to `dist/holyholyholy3d` (also part of `npm run build`) |
| `npm run dev:game3d` | export and serve on port 5175 |
| `npm run game3d:smoke` | headless Chrome plays a whole first chapter (`CHROME_PATH=` to pick the browser) |
| `npm run game3d:content` | rebuild `assets/data/content.json` |
| `npm run game3d:art` / `game3d:billboards` | paint and process / build billboard models |
| `npm run game3d:libs` | rebuild `lib/*.js` from `src/` |
| `npm run game3d:assets` | rebuild low-poly models and UI images |
| `npm run game3d:fonts` | rebuild the fonts (Cinzel, EB Garamond subset with Polish letters) |

## Tests

* `npm test` (Vitest) covers the libraries, `content.json` and the project: content up to
  date; every text resolving cleanly for a man and a woman; every chapter with its story,
  three stages (clocks, skies, modifiers, memories), four voices (a known thinking error, a
  negation and a truth), the lie personified (never a fortress: no "twierdza" anywhere), a
  thought record (distorted, sugar-coated, balanced) and a tool; Christ speaking only
  Scripture, always with the reference; help lines with every crisis thought; every painting
  the content names present; zero validation issues in the project.
* `npm run game3d:smoke` plays the way a new player does: the safety note, who you protect,
  how to play, the prologue, the Ladder, the archangels, the chapter's story, the fight (true
  sentences, a gift card, a strike, the prayer, a voice silenced with its negation and truth,
  healing by a word of truth, a spring and a breath, a memory, the recognition card, three
  stages, the lie in its own figure, the praise), the healing scene, the worked thought
  record, the tool in the toolbox, the Fruits, the Book of Truth and the breathing practice.
  On every screen it photographs it checks the layout: no two texts of a panel overlap, none
  runs out of its panel or the screen, no caption is taller than its button. Any page error
  or layout issue fails it. `SMOKE_SIZE=864x540` plays it on a 16:10 screen, `720x540` on
  4:3. Screenshots go to `game3d/.smoke/`.

## Licences

The repository is AGPL-3.0-or-later. The GDevelop runtime and the official extensions are MIT
(the export includes `LICENSE.GDevelop.txt`). Cinzel and EB Garamond are under the SIL Open
Font License (`assets/fonts/OFL-*.txt`). Scripture is the Gdańsk Bible (1881 edition, public
domain). The paintings were made with DreamShaper XL Lightning (CreativeML Open RAIL++-M:
outputs are free to use, within its use restrictions); models, textures and music are
generated by this repository's code.
