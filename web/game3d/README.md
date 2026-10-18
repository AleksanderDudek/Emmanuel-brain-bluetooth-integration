# HolyHolyHoly 3D — a GDevelop game

A 3D browser reinterpretation of [HolyHolyHoly](../game/DESIGN.md), built with
[GDevelop](https://gdevelop.io) ([source](https://github.com/4ian/GDevelop)). A guardian
angel breaks the traumas of a man named Adam, which turn into truths, and tears down the
strongholds of the lies he believed (2 Cor 10:4). The play mixes Archero (the Word flies
while you stand still), survivors-likes (waves, 1 of 3 gifts per level) and Endless Puncher
(strikes in combos, a miss breaks the combo). There is no Pac-Man motif and no spoken
prayer. The Mendi fNIRS band is optional. The game is in Polish. The design document, also
in Polish, is [DESIGN.md](DESIGN.md).

```bash
cd web
npm ci
npm run dev:game3d     # check + export, then http://localhost:5175
npm run build          # BrainLink, HolyHolyHoly and this game → dist/, dist/holyholyholy3d/
```

## Opening it in GDevelop

The game is a normal GDevelop project, saved as a **folder project** (one JSON file per
scene, external events and extension, which keeps diffs readable):

```
project/
├── HolyHolyHoly3D.json        ← open this in GDevelop (5.6.269 or newer)
├── layouts/                   scenes: title, tree, arena, revelation
├── externalEvents/ui.json     the UI events every scene links to
├── eventsFunctionsExtensions/ HolyHoly, Psalm150, MendiFocus + official extensions
├── assets/                    models, textures, ui, particles, fonts, data/content.json
└── lib/                       psalm150.js, mendi-focus.js (built; see below)
```

Open `project/HolyHolyHoly3D.json` in the GDevelop desktop app and press Preview. Edit
scenes, events and objects in the editor as usual; `npm run game3d:check` then validates
what you saved.

How the events are organised:

* **Groups and comments.** Each scene's events are grouped by system (Setup, Angel, Fire of
  the Spirit, The Word, Strike of Samson, Gifts, Traumas, Waves, Stronghold, HUD…). Every
  group starts with a comment that explains the rules.
* **Balance in one place.** All numbers live in the global structure `Tuning` (speeds,
  damage, wave length, spawn rate, stronghold HP).
* **Content as data.** Chapters, traumas, gifts, fruits and ranks come from
  `assets/data/content.json`, loaded into the global `Content` (`HolyHoly::LoadJsonIntoGlobal`).
  Progress is in the global `Save`, kept in `localStorage` and merged over the defaults
  (`HolyHoly::LoadSave` / `StoreSave`).
* **UI.** These global objects are used by every scene: `UiPanel`, `UiButton` + `UiLabel`,
  `UiText`, `UiTitle`, `UiIcon` and a few more. `HolyHoly::MakeButton`, `MakeText` and
  `MakePanel` create them, and every UI object carries two variables:
  * `Panel`: the panel it belongs to, so the whole panel can be deleted at once;
  * `Key`: lets events update the text every frame (for example `UiText.Key = "wave"`).
  A click on a button of the top panel (`Ui.top`) puts its `Action` into `Ui.clicked` for one
  frame (external events `UI`), and scenes react with *Ui.clicked = "…"*.
* **One creation per event.** GDevelop picks every instance created in an event. When an
  event creates several objects of one kind, each creation and the actions that follow it
  get their own sub-event. Otherwise the later actions would change all of them.

## Extensions

| Extension | What it is |
|---|---|
| `HolyHoly` | this game's helpers: content and save, 3D→screen projection (floating truths), touch / reduced-motion checks, rank and chapter queries, UI builders |
| `Psalm150` | the "Psalm 150" soundtrack and effects: `lib/psalm150.js`, bundled from `../game/src/audio` (the 2D game's Web Audio engine) |
| `MendiFocus` | focus and the optional Mendi band: `lib/mendi-focus.js`, bundled from BrainLink's Web Bluetooth adapter, fNIRS pipeline and the 2D game's focus charger |
| `FireBullet`, `SpriteMultitouchJoystick`, `ParticleEmitter3D`, `ShakeObject3D` | official extensions from GDevelop's extension store |

`Psalm150` and `MendiFocus` include their libraries through the extensions' **source files**,
GDevelop's mechanism for JavaScript libraries. Previews and exports add them to the page.
The libraries are built from `src/` (`npm run game3d:libs`), and `game3d:check` fails if the
committed files are out of date. Both are safe without the library (they just do nothing).

## Toolchain: GDevelop without the editor

`tools/` drives GDevelop's own core library (libGD.js) from the pinned npm package
`gdcore-tools` (GDevelop 5.6.269 core and runtime). This lets CI check and export the game:

* `tools/gdevelop.mjs` loads the project and **validates** the events of the scenes, the
  external events and this project's own extensions:
  * each action and condition must exist, with the parameter count its metadata declares;
  * yes/no and true/false parameters must be literals (GDevelop silently compiles anything
    else to `false`);
  * in scenes and external events, each expression must parse and resolve: objects,
    behaviors, variables (including locals), functions, Repeat counts.
  Official store extensions are taken as published. The tool then exports the HTML5 game
  and collects GDevelop's own diagnostics.
* After the export it makes small fixes to the exported page. GDevelop 5.6.269 lists the
  Draco decoder's `.wasm` among the page's scripts, so that tag is removed (later releases
  fixed this). It also adds a `<title>`, `lang="pl"`, a favicon and a description.

| Script | Does |
|---|---|
| `npm run game3d:check` | libraries and content up to date, project valid (no output files) |
| `npm run game3d:export` | export to `dist/holyholyholy3d` (also part of `npm run build`) |
| `npm run dev:game3d` | export and serve on port 5175 |
| `npm run game3d:smoke` | headless Chrome plays a whole chapter (needs an export; `CHROME_PATH=` to pick the browser) |
| `npm run game3d:content` | rebuild `assets/data/content.json` from `../game/src/content` |
| `npm run game3d:libs` | rebuild `lib/*.js` from `src/` |
| `npm run game3d:assets` | rebuild models (`build-models.mjs`, three.js → GLB) and images (`build-textures.mjs`) |
| `npm run game3d:fonts` | rebuild the fonts (Python + fontTools; Cinzel, EB Garamond subset with Polish letters) |

Models, images, fonts, `content.json` and `lib/*.js` are generated: change their generators,
not the files. The scenes, events and objects are the source: change them in GDevelop. The
project was first written with GDevelop's core API. From now on, edit it as an ordinary
GDevelop project.

## Tests

* `npm test` (Vitest) covers the libraries, `content.json` (up to date and consistent),
  and the project. For the project it loads `HolyHolyHoly3D.json` with libGD and requires
  zero validation issues, all resource files, the extension source files, and the GDevelop
  splash and watermark.
* `npm run game3d:smoke` runs in headless Chrome. It plays the title, a chapter (a gift, a
  strike combo, a tongue of fire, three waves, the stronghold and its chains), the
  revelation and save, and the Tree with the next sphere open. Any page error fails it.
  Screenshots go to `game3d/.smoke/` (git-ignored).

## Licences

The repository is AGPL-3.0-or-later. The GDevelop runtime and the official extensions are
MIT (the export includes `LICENSE.GDevelop.txt`). The fonts Cinzel and EB Garamond are
under the SIL Open Font License (`assets/fonts/OFL-*.txt`). The models, textures and music
are generated by this repository's code.
