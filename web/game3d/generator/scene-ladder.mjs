// Ladder: the map of the story, after the icon of the Ladder of Divine Ascent (St John Climacus):
// ten rungs from the ground to Christ at the top. Choose a chapter, receive the Fruits of the
// Spirit, read the Book of Truth (the lies that fell, the thoughts and how they lie), and open the
// toolbox of skills learned on the way, with guided breathing.
import { A, C, NOT, OR, ev, group, comment, q, set, setS, setB, is, isS, isB, cmp, cmpS, oisS, ois, oset, osetS, text, keyJust, link, begins, scene, anim, animE, forEachChild, repeat, whileEv, center, setZ, width, size, tint, opacity } from './dsl.mjs';
import { model, cube, particles, instance, v } from './objects.mjs';
import { button, label, box, closePanel, sfx, clicked, SAVE_KEY, HERO_IDS, breathingPanel, breathingEvents } from './ui.mjs';
import { lightingLayers, applyQuality, bootEvents, heroBillboards } from './scene-title.mjs';
import { aspectOf, foreshortening, paintingOf, floorTexture } from './art.mjs';

const CH = 'Content.chapters[Sel]';
const P = name => [setS('Ui.top', '=', q(name))];
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));
const G = t => `HolyHoly::G(${t})`;
const ELEVATION = 46;

export function ladderScene() {
  const objects = [
    cube('Garden', { w: 5000, h: 5000, d: 10, top: floorTexture('mosaic'), topRepeat: true, tileScale: 0.3, tint: '78;72;70' }),
    cube('Path', { w: 100, h: 14, d: 8, top: 'assets/ui/bar.png', tint: '214;170;90', castShadow: true }),
    model('OrbDone', 'assets/models/orb-done.glb', { w: 90, h: 90, d: 120, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Chapter')] }),
    model('OrbOpen', 'assets/models/orb-open.glb', { w: 90, h: 90, d: 120, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Chapter')] }),
    model('OrbLocked', 'assets/models/orb-locked.glb', { w: 80, h: 80, d: 105, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Chapter')] }),
    ...heroBillboards(120, ELEVATION),
    model('Christ', 'assets/models/christ.glb', { w: 260, h: 100, d: Math.round(260 * aspectOf(paintingOf('christ')) * foreshortening(ELEVATION)), keepAspect: false, castShadow: false, receiveShadow: false, anims: [['Idle', 'Idle']] }),
    model('Light', 'assets/models/fx-glow.glb', { w: 420, h: 420, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter', anims: [['Idle', 'Idle']] }),
    model('Candle', 'assets/models/candle.glb', { w: 34, h: 34, d: 60, anims: [['Idle', 'Idle']] }),
    particles('Motes', 'assets/particles/soft.png', { StartColor: '255;236;170', EndColor: '255;255;240', StartOpacity: 200, EndOpacity: 0, Flow: 18, StartSizeMin: 5, StartSizeMax: 12, EndScale: 0.3, StartSpeedMin: 10, StartSpeedMax: 35, LifespanMin: 3, LifespanMax: 6, Duration: -1, SpayConeAngle: 360, Gravity: -10, Blending: 'Additive', ShouldAutodestruct: false }),
  ];
  const candles = [[-230, 700], [230, 700], [-260, 760], [260, 760]];
  const instances = [
    instance('Garden', -2500, -2500, { z: -10, w: 5000, h: 5000, d: 10, locked: true }),
    ...candles.map(([x, y]) => instance('Candle', x, y, { w: 34, h: 34, d: 60 })),
    instance('Motes', 0, 0, { z: 60 }),
  ];
  const node = i => [`Content.chapters[${i}].node.x`, `Content.chapters[${i}].node.y`];
  const [selX, selY] = node('Sel');
  const card = [
    box('24', 'SceneWindowHeight() - 330', '700', '310', { panel: '', key: 'card' }),
    label('UiSmall', '56', 'SceneWindowHeight() - 312', 640, '', { key: 'place' }),
    label('UiTitle', '54', 'SceneWindowHeight() - 286', 640, '', { key: 'title' }),
    label('UiSmall', '56', 'SceneWindowHeight() - 228', 640, '', { key: 'fact' }),
    label('UiText', '56', 'SceneWindowHeight() - 150', 640, '', { key: 'lie' }),
    button('56', 'SceneWindowHeight() - 78', '64', '50', '◀', 'prev'),
    button('128', 'SceneWindowHeight() - 78', '64', '50', '▶', 'next'),
    label('UiSmall', '206', 'SceneWindowHeight() - 68', 290, '', { key: 'status' }),
    button('500', 'SceneWindowHeight() - 82', '200', '58', 'Wejdź', 'enter'),
  ];
  const topBar = [
    box('24', '16', '520', '96', { key: 'topbar' }),
    label('UiText', '50', '26', 480, '', { key: 'rank' }),
    label('UiSmall', '50', '68', 480, '', { key: 'progress' }),
    button('SceneWindowWidth() - 860', '28', '200', '54', 'Owoce Ducha', 'fruits'),
    button('SceneWindowWidth() - 650', '28', '210', '54', 'Księga Prawdy', 'book'),
    button('SceneWindowWidth() - 430', '28', '200', '54', 'Narzędzia', 'tools'),
    button('SceneWindowWidth() - 220', '28', '196', '54', 'Menu', 'menu'),
  ];

  // Fruits of the Spirit: nine cards in a 3×3 grid
  const fx = '(SceneWindowWidth() - 1140) / 2';
  const fruitCard = [
    ev([], [
      set('fx', '=', `${fx} + 30 + mod(i, 3) * 365`),
      set('fy', '=', '140 + floor(i / 3) * 166'),
      set('lvl', '=', 'Save.fruits[fruit.id]'),
    ], [
      ev([], [
        box('fx', 'fy', '350', '160', { obj: 'UiCard', panel: 'fruits' }),
        label('UiText', 'fx + 20', 'fy + 12', 310, '', { panel: 'fruits', expr: 'fruit.name + "  " + HolyHoly::PipsText(lvl, fruit.maxLevel)' }),
        label('UiSmall', 'fx + 20', 'fy + 50', 310, '', { panel: 'fruits', expr: 'fruit.effect' }),
      ]),
      ev([cmp('lvl', '<', 'fruit.maxLevel'), cmp('Save.manna', '>=', 'fruit.costs[lvl]')], [
        button('fx + 20', 'fy + 104', '310', '44', '', 'buy', { arg: 'i', panel: 'fruits', captionExpr: '"Przyjmij · " + ToString(fruit.costs[lvl]) + " manny"' }),
      ]),
      ev([cmp('lvl', '<', 'fruit.maxLevel'), cmp('Save.manna', '<', 'fruit.costs[lvl]')], [
        label('UiSmall', 'fx + 20', 'fy + 116', 310, '', { panel: 'fruits', align: 'center', expr: '"Potrzeba " + ToString(fruit.costs[lvl]) + " manny"' }),
      ]),
      ev([cmp('lvl', '>=', 'fruit.maxLevel')], [
        label('UiSmall', 'fx + 20', 'fy + 116', 310, 'Owoc dojrzał w pełni', { panel: 'fruits', align: 'center' }),
      ]),
    ]),
    ev([], [set('i', '+', '1')]),
  ];

  const BX = '(SceneWindowWidth() - 940) / 2';
  const events = [
    link('UI'),
    bootEvents(),
    group('Scene', [
      comment('The Ladder lies on the ground like an icon seen from above: rails and rungs (Content.ladder.paths), a sphere on each rung (gold when done, white when open, dark when locked), Christ at the top. The guardian archangel stands by the chosen rung.'),
      ev([begins()], [
        set('Count', '=', 'VariableChildCount(Content.chapters)'),
        set('Sel', '=', 'clamp(Save.selected, 0, Count - 1)'),
        setS('Ui.top', '=', '""'),
        A('Psalm150::SetMood', q('menu'), q('menu'), '0.15'),
        A('SetCameraCenterX', '=', selX, '""'),
        A('SetCameraCenterY', '=', `${selY} + 820`, '""'),
        A('Scene3D::SetCameraZ', '=', '980', '""'),
        A('Scene3D::SetCameraRotationX', '=', String(90 - ELEVATION), '""'),
        A('CreateByName', 'Heroes', '"Hero_" + Save.hero', selX, `${selY} + 60`, '""'),
        A('Create', 'Light', 'Content.ladder.top.x', 'Content.ladder.top.y', '""'), setZ('Light', '2'),
        setB('Rebuild', true),
      ], [
        ...applyQuality(),
        ev([isB('Save.settings.veiled', false)], [A('Create', 'Christ', 'Content.ladder.top.x', 'Content.ladder.top.y', '""')]),
        ev([], [], [forEachChild('Content.ladder.paths', 'path', '', [], [
          A('Create', 'Path', '0', '0', '""'),
          width('Path', 'path.length'),
          A('SetAngle', 'Path', '=', 'path.angle'),
          center('Path', 'path.cx', 'path.cy'),
          setZ('Path', '1'),
        ])], { vars: { path: { cx: 0, cy: 0, length: 0, angle: 0 } } }),
        ev([], [], [
          repeat('Count', [], [], [
            ev([C('HolyHoly::IsChapterDone', 'i')], [A('Create', 'OrbDone', ...node('i'), '""'), oset('OrbDone', 'Chapter', '=', 'i')]),
            ev([NOT(C('HolyHoly::IsChapterDone', 'i')), C('HolyHoly::IsChapterOpen', 'i')], [A('Create', 'OrbOpen', ...node('i'), '""'), oset('OrbOpen', 'Chapter', '=', 'i')]),
            ev([NOT(C('HolyHoly::IsChapterOpen', 'i'))], [A('Create', 'OrbLocked', ...node('i'), '""'), oset('OrbLocked', 'Chapter', '=', 'i')]),
          ], { index: 'i' }),
        ], { vars: { i: 0 } }),
        ev([], [...topBar]),
      ]),
      comment('The camera and the archangel glide to the chosen rung.'),
      ev([], [
        A('SetCameraCenterX', '=', `lerp(CameraCenterX(""), ${selX} - 180, min(1, 4 * TimeDelta()))`, '""'),
        A('SetCameraCenterY', '=', `lerp(CameraCenterY(""), ${selY} + 760, min(1, 4 * TimeDelta()))`, '""'),
        A('SetXY', 'Heroes', '=', `lerp(Heroes.X(), ${selX} + 150, min(1, 5 * TimeDelta()))`, '=', `lerp(Heroes.Y(), ${selY} + 40, min(1, 5 * TimeDelta()))`),
      ]),
    ]),
    group('Choosing a chapter', [
      ev([isS('Ui.top', '=', '""'), OR(keyJust('Left'), keyJust('a'), keyJust('Down'), keyJust('s'))], [setS('Ui.clicked', '=', q('prev'))]),
      ev([isS('Ui.top', '=', '""'), OR(keyJust('Right'), keyJust('d'), keyJust('Up'), keyJust('w'))], [setS('Ui.clicked', '=', q('next'))]),
      ev([isS('Ui.top', '=', '""'), keyJust('Return')], [setS('Ui.clicked', '=', q('enter'))]),
      ev([clicked('prev')], [set('Sel', '=', 'mod(Sel - 1 + Count, Count)'), setB('Rebuild', true), sfx('click')]),
      ev([clicked('next')], [set('Sel', '=', 'mod(Sel + 1, Count)'), setB('Rebuild', true), sfx('click')]),
      comment('A click on a sphere chooses it (the cursor is projected on the ground of the 3D layer).'),
      ev([isS('Ui.top', '=', '""'), C('MouseButtonFromTextReleased', q('Left')), NOT(C('IsCursorOnObject', 'UiPanel')), NOT(C('IsCursorOnObject', 'UiButton'))], [], [
        ev([C('PickNearest', 'Orbs', 'CursorX("")', 'CursorY("")'), cmp('Orbs.DistanceToPosition(CursorX(""), CursorY(""))', '<', '90')], [set('Sel', '=', 'Orbs.Chapter'), setB('Rebuild', true), sfx('click')]),
      ]),
      ev([clicked('enter'), C('HolyHoly::IsChapterOpen', 'Sel')], [
        set('Save.selected', '=', 'Sel'), set('Run.chapter', '=', 'Sel'), store(), sfx('door'),
        scene('Synaxis'),
      ]),
      ev([clicked('enter'), NOT(C('HolyHoly::IsChapterOpen', 'Sel'))], [sfx('weaken')]),
      ev([clicked('menu')], [scene('Title')]),
    ]),
    group('Chapter card', [
      ev([isB('Rebuild', true)], [setB('Rebuild', false), set('Save.selected', '=', 'Sel')], [
        ...['card', 'place', 'title', 'fact', 'lie', 'status'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')])),
        ...['prev', 'next', 'enter'].map(a => ev([oisS('UiButton', 'Action', '=', q(a)), oisS('UiButton', 'Panel', '=', '""')], [A('Delete', 'UiButton')])),
        ev([oisS('UiLabel', 'Panel', '=', '""'), OR(oisS('UiLabel', 'Action', '=', q('prev')), oisS('UiLabel', 'Action', '=', q('next')), oisS('UiLabel', 'Action', '=', q('enter')))], [A('Delete', 'UiLabel')]),
        ev([], card),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('place'))], [text('UiSmall', `"Szczebel " + ToString(Sel + 1) + " · " + ToUpperCase(${G(`${CH}.place`)})`)]),
      ev([oisS('UiTitle', 'Key', '=', q('title'))], [text('UiTitle', `${CH}.title + " · " + ${G(`${CH}.theme`)}`)]),
      ev([oisS('UiSmall', 'Key', '=', q('fact'))], [text('UiSmall', G(`${CH}.fact`))]),
      ev([oisS('UiText', 'Key', '=', q('lie'))], [text('UiText', `"Kłamstwo: „" + ${G(`${CH}.boss.lie`)} + "”"`)]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), C('HolyHoly::IsChapterDone', 'Sel')], [text('UiSmall', q('Twierdza zburzona ✓'))]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), NOT(C('HolyHoly::IsChapterDone', 'Sel')), C('HolyHoly::IsChapterOpen', 'Sel')], [text('UiSmall', q('Otwarty. Wejdź!'))]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), NOT(C('HolyHoly::IsChapterOpen', 'Sel'))], [text('UiSmall', `"Najpierw: " + ${CH}.unlockedByTitle`)]),
      ev([oisS('UiButton', 'Action', '=', q('enter')), NOT(C('HolyHoly::IsChapterOpen', 'Sel'))], [tint('UiButton', q('120;112;130'))]),
    ]),
    group('Top bar', [
      ev([oisS('UiText', 'Key', '=', q('rank'))], [text('UiText', '"Ranga: " + HolyHoly::RankName(Save.light) + "   ·   manna: " + ToString(Save.manna)')]),
      ev([oisS('UiSmall', 'Key', '=', q('progress')), cmp('HolyHoly::NextRankLight(Save.light)', '>', '0')], [text('UiSmall', '"Światło: " + ToString(Save.light) + " / " + ToString(HolyHoly::NextRankLight(Save.light)) + " · przemienionych myśli: " + ToString(Save.reframes)')]),
      ev([oisS('UiSmall', 'Key', '=', q('progress')), cmp('HolyHoly::NextRankLight(Save.light)', '=', '0')], [text('UiSmall', '"Światło: " + ToString(Save.light) + " · przemienionych myśli: " + ToString(Save.reframes)')]),
    ]),
    group('Fruits of the Spirit', [
      comment('Lasting talents bought with manna (Ga 5,22-23), applied in the Arena; deterministic and never lost. After a purchase the panel is built again (Reopen).'),
      ev([isS('Reopen', '!=', '""')], [setS('Ui.clicked', '=', 'Reopen'), setS('Reopen', '=', '""')]),
      ev([clicked('fruits')], [...P('fruits')], [
        ev([], [
          box('(SceneWindowWidth() - 1140) / 2', '24', '1140', '680', { panel: 'fruits' }),
          label('UiTitle', '(SceneWindowWidth() - 1140) / 2', '40', 1140, 'Owoce Ducha', { panel: 'fruits', align: 'center' }),
          label('UiSmall', '(SceneWindowWidth() - 1140) / 2', '96', 1140, '', { panel: 'fruits', align: 'center', expr: '"Manna: " + ToString(Save.manna) + " · „Ale owoc Ducha jest miłość, wesele, pokój…” (Ga 5,22)"' }),
          button('(SceneWindowWidth() - 220) / 2', '636', '220', '52', 'Zamknij', 'close', { panel: 'fruits' }),
        ]),
        ev([], [], [forEachChild('Content.fruits', 'fruit', '', [], [], fruitCard)], { vars: { i: 0, fx: 0, fy: 0, lvl: 0, fruit: { id: '', name: '', effect: '', maxLevel: 0, costs: [] } } }),
      ]),
      ev([clicked('buy')], [], [
        ev([cmp('Save.fruits[Content.fruits[Ui.arg].id]', '<', 'Content.fruits[Ui.arg].maxLevel'), cmp('Save.manna', '>=', 'Content.fruits[Ui.arg].costs[Save.fruits[Content.fruits[Ui.arg].id]]')], [
          set('Save.manna', '-', 'Content.fruits[Ui.arg].costs[Save.fruits[Content.fruits[Ui.arg].id]]'),
          set('Save.fruits[Content.fruits[Ui.arg].id]', '+', '1'),
          store(), sfx('rank'), setS('Reopen', '=', q('fruits')),
        ], closePanel('fruits')),
      ]),
    ]),
    group('Book of Truth', [
      comment('Two parts: the lies whose strongholds fell, with the truth and a verse; and the thoughts met on the way, how each one lies, the question that tests it and what it turns into.'),
      ev([clicked('book')], [...P('book'), set('Book', '=', '-1'), set('BookStep', '=', '1'), setS('Ui.clicked', '=', q('bookMove'))]),
      ev([clicked('bookPrev')], [set('BookStep', '=', '-1'), setS('Ui.clicked', '=', q('bookMove'))]),
      ev([clicked('bookNext')], [set('BookStep', '=', '1'), setS('Ui.clicked', '=', q('bookMove'))]),
      ev([clicked('bookMove')], [set('Tries', '=', '0')], [
        ev([], [set('Book', '=', 'mod(Book + BookStep + Count, Count)'), set('Tries', '+', '1')]),
        whileEv([NOT(C('HolyHoly::IsChapterDone', 'Book')), cmp('Tries', '<', 'Count')], [], [set('Book', '=', 'mod(Book + BookStep + Count, Count)'), set('Tries', '+', '1')]),
        ev([], [], closePanel('book')),
        ev([], [
          box(BX, '40', '940', '650', { panel: 'book' }),
          label('UiTitle', BX, '56', 940, 'Księga Prawdy', { panel: 'book', align: 'center' }),
          button(`${BX} + 300`, '626', '170', '50', 'Myśli', 'thoughts', { panel: 'book' }),
          button(`${BX} + 480`, '626', '170', '50', 'Zamknij', 'close', { panel: 'book' }),
        ]),
        ev([C('HolyHoly::IsChapterDone', 'Book')], [
          label('UiSmall', `${BX} + 60`, '114', 820, '', { panel: 'book', align: 'center', expr: '"Szczebel " + ToString(Book + 1) + " · " + Content.chapters[Book].title' }),
          label('UiText', `${BX} + 60`, '150', 820, '', { panel: 'book', expr: '"Kłamstwo: „" + HolyHoly::G(Content.chapters[Book].boss.lie) + "”"' }),
          label('UiText', `${BX} + 60`, '240', 820, '', { panel: 'book', expr: '"Prawda: " + HolyHoly::G(Content.chapters[Book].cbt.truth)' }),
          label('UiSmall', `${BX} + 60`, '420', 820, '', { panel: 'book', expr: '"„" + HolyHoly::G(Content.chapters[Book].cbt.verse.text) + "” (" + HolyHoly::G(Content.chapters[Book].cbt.verse.ref) + ")"' }),
          button(`${BX} + 40`, '626', '90', '50', '◀', 'bookPrev', { panel: 'book' }),
          button(`${BX} + 810`, '626', '90', '50', '▶', 'bookNext', { panel: 'book' }),
        ]),
        ev([NOT(C('HolyHoly::IsChapterDone', 'Book'))], [
          label('UiText', `${BX} + 90`, '260', 760, 'Księga jest jeszcze pusta. Każda zburzona twierdza zapisze tu kłamstwo, które upadło, i prawdę, która je zastąpiła.', { panel: 'book', align: 'center' }),
        ]),
      ]),
      comment('Thoughts: every shadow-thought seen at least once, with its painting.'),
      ev([clicked('thoughts')], [set('Page', '=', '-1'), set('PageStep', '=', '1'), setS('Ui.clicked', '=', q('thoughtMove'))]),
      ev([clicked('thoughtPrev')], [set('PageStep', '=', '-1'), setS('Ui.clicked', '=', q('thoughtMove'))]),
      ev([clicked('thoughtNext')], [set('PageStep', '=', '1'), setS('Ui.clicked', '=', q('thoughtMove'))]),
      ev([clicked('thoughtMove')], [set('Tries', '=', '0'), set('Kinds', '=', 'VariableChildCount(Content.enemyOrder)')], [
        ev([], [set('Page', '=', 'mod(Page + PageStep + Kinds, Kinds)'), set('Tries', '+', '1')]),
        whileEv([NOT(C('BooleanVariable', 'Save.seen[Content.enemyOrder[Page]]', 'True')), cmp('Tries', '<', 'Kinds')], [], [set('Page', '=', 'mod(Page + PageStep + Kinds, Kinds)'), set('Tries', '+', '1')]),
        ev([], [setS('Ui.top', '=', q('book'))], closePanel('book')),
        ev([], [
          box(BX, '40', '940', '650', { panel: 'book' }),
          label('UiTitle', BX, '56', 940, 'Myśli i ich prawdy', { panel: 'book', align: 'center' }),
          button(`${BX} + 300`, '626', '170', '50', 'Kłamstwa', 'book', { panel: 'book' }),
          button(`${BX} + 480`, '626', '170', '50', 'Zamknij', 'close', { panel: 'book' }),
        ]),
        ev([C('BooleanVariable', 'Save.seen[Content.enemyOrder[Page]]', 'True')], [setS('k', '=', 'Content.enemyOrder[Page]')], [
          ev([], [
            A('Create', 'UiArt', `${BX} + 170`, '330', q('UI')), animE('UiArt', '"enemy-" + k'), size('UiArt', '200', '292'), osetS('UiArt', 'Panel', '=', q('book')), A('SetZOrder', 'UiArt', '=', '280'),
            label('UiText', `${BX} + 300`, '116', 600, '', { panel: 'book', expr: 'Content.enemies[k].name + " · " + HolyHoly::G(Content.enemies[k].distortionName)' }),
            label('UiSmall', `${BX} + 300`, '160', 600, '', { panel: 'book', expr: '"Szepcze: „" + HolyHoly::G(Content.enemies[k].thoughts[0]) + "”"' }),
            label('UiSmall', `${BX} + 300`, '250', 600, '', { panel: 'book', expr: '"Pytanie, które ją sprawdza: " + HolyHoly::G(Content.distortions[Content.enemies[k].distortion].question)' }),
            label('UiText', `${BX} + 300`, '360', 600, '', { panel: 'book', expr: '"Prawdziwiej: „" + HolyHoly::G(Content.enemies[k].reframes[0]) + "”"' }),
            label('UiSmall', `${BX} + 300`, '470', 600, '', { panel: 'book', expr: '"Anioł mówi: " + HolyHoly::G(Content.enemies[k].angel[0])' }),
            button(`${BX} + 40`, '626', '90', '50', '◀', 'thoughtPrev', { panel: 'book' }),
            button(`${BX} + 810`, '626', '90', '50', '▶', 'thoughtNext', { panel: 'book' }),
          ]),
        ], { vars: { k: '' } }),
        ev([NOT(C('BooleanVariable', 'Save.seen[Content.enemyOrder[Page]]', 'True'))], [
          label('UiText', `${BX} + 90`, '260', 760, 'Tu zapiszą się myśli, które przemienisz w walce: jak kłamią i co mówią naprawdę.', { panel: 'book', align: 'center' }),
        ]),
      ]),
    ]),
    group('Toolbox', [
      comment('Skills learned in the chapters (Save.tools): what it is, the steps, the challenge for today, and what research says. Breathing can be practised here.'),
      ev([clicked('tools')], [...P('tools'), set('Tool', '=', '-1'), set('ToolStep', '=', '1'), setS('Ui.clicked', '=', q('toolMove'))]),
      ev([clicked('toolPrev')], [set('ToolStep', '=', '-1'), setS('Ui.clicked', '=', q('toolMove'))]),
      ev([clicked('toolNext')], [set('ToolStep', '=', '1'), setS('Ui.clicked', '=', q('toolMove'))]),
      ev([clicked('toolMove')], [set('Tries', '=', '0')], [
        ev([], [set('Tool', '=', 'mod(Tool + ToolStep + Count, Count)'), set('Tries', '+', '1')]),
        whileEv([NOT(C('BooleanVariable', 'Save.tools[Content.chapters[Tool].tool.id]', 'True')), cmp('Tries', '<', 'Count')], [], [set('Tool', '=', 'mod(Tool + ToolStep + Count, Count)'), set('Tries', '+', '1')]),
        ev([], [setS('Ui.top', '=', q('tools'))], closePanel('tools')),
        ev([], [
          box(BX, '40', '940', '650', { panel: 'tools' }),
          label('UiTitle', BX, '56', 940, 'Narzędzia na co dzień', { panel: 'tools', align: 'center' }),
          button(`${BX} + 385`, '626', '170', '50', 'Zamknij', 'close', { panel: 'tools' }),
        ]),
        ev([C('BooleanVariable', 'Save.tools[Content.chapters[Tool].tool.id]', 'True')], [], [
          ev([], [
            label('UiText', `${BX} + 60`, '114', 820, '', { panel: 'tools', align: 'center', expr: 'Content.chapters[Tool].tool.name + " · z rozdziału „" + Content.chapters[Tool].title + "”"' }),
            label('UiSmall', `${BX} + 60`, '156', 820, '', { panel: 'tools', align: 'center', expr: 'HolyHoly::G(Content.chapters[Tool].tool.summary)' }),
            label('UiSmall', `${BX} + 80`, '220', 780, '', { panel: 'tools', key: 'steps' }),
            label('UiSmall', `${BX} + 80`, '470', 780, '', { panel: 'tools', expr: '"Wyzwanie na dziś: " + HolyHoly::G(Content.chapters[Tool].tool.practice)' }),
            label('UiSmall', `${BX} + 80`, '540', 780, '', { panel: 'tools', expr: '"Co mówią badania: " + Content.chapters[Tool].tool.evidence' }),
            button(`${BX} + 40`, '626', '90', '50', '◀', 'toolPrev', { panel: 'tools' }),
            button(`${BX} + 810`, '626', '90', '50', '▶', 'toolNext', { panel: 'tools' }),
          ]),
          ev([isB('Content.chapters[Tool].tool.breathing', true)], [button(`${BX} + 585`, '626', '200', '50', 'Ćwicz teraz', 'breathe', { panel: 'tools' })]),
        ]),
        ev([NOT(C('BooleanVariable', 'Save.tools[Content.chapters[Tool].tool.id]', 'True'))], [
          label('UiText', `${BX} + 90`, '260', 760, 'Po każdej zburzonej twierdzy dostaniesz tu jedno prawdziwe narzędzie: sposób radzenia sobie z myślami i uczuciami, sprawdzony w badaniach.', { panel: 'tools', align: 'center' }),
        ]),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('steps'))], [text('UiSmall', '""')], [
        forEachChild('Content.chapters[Tool].tool.steps', 'stepText', 'n', [], [], [
          ev([], [text('UiSmall', 'UiSmall.Text::Value() + ToString(ToNumber(n) + 1) + ". " + HolyHoly::G(stepText) + NewLine()')]),
        ], { vars: { stepText: '', n: '' } }),
      ]),
      ev([clicked('breathe')], [], [...closePanel('tools'), ev([], breathingPanel('breath'))]),
      breathingEvents('breath', ''),
    ]),
    group('Panels', [
      ev([clicked('close'), OR(isS('Ui.top', '=', q('fruits')), isS('Ui.top', '=', q('book')), isS('Ui.top', '=', q('tools')))], [setS('Ui.top', '=', '""')], [...closePanel('fruits'), ...closePanel('book'), ...closePanel('tools')]),
    ]),
  ];
  return {
    name: 'Ladder',
    background: [14, 12, 10],
    layers: lightingLayers({ fog: '14;12;10', near: 1300, far: 3800, sky: '255;242;214', ground: '80;64;44', sun: 0.8, hemi: 0.62 }),
    objects,
    instances,
    events,
    variables: [v.num('Sel'), v.num('Count'), v.bool('Rebuild'), v.num('Book', -1), v.num('BookStep', 1), v.num('Page', -1), v.num('PageStep', 1), v.num('Kinds'),
      v.num('Tool', -1), v.num('ToolStep', 1), v.num('Tries'), v.str('Reopen'), v.bool('Breathing'), v.num('BreathT')],
    groups: [['Orbs', ['OrbDone', 'OrbOpen', 'OrbLocked']], ['Heroes', HERO_IDS.map(id => `Hero_${id}`)]],
  };
}
