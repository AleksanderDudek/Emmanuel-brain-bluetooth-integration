// Synaxis: the choice of the guardian for a chapter. The seven archangels stand together beneath
// Christ, as in the icon of the Synaxis of the Archangels (8 November). Each one shows his gift,
// his prayer and his trait; the locked ones say which chapter brings them, and each can be tried
// once (as in Heroes vs Hordes' "Try").
import { A, C, NOT, OR, ev, group, comment, q, set, setS, setB, isS, isB, cmp, cmpS, oisS, ois, oset, osetS, text, keyJust, link, begins, scene, anim, animE, size, opacity, setZ, scale, forEach, repeat, dt } from './dsl.mjs';
import { model, cube, particles, instance, v } from './objects.mjs';
import { button, label, box, closePanel, sfx, clicked, SAVE_KEY, HERO_IDS } from './ui.mjs';
import { lightingLayers, applyQuality, bootEvents, heroBillboards } from './scene-title.mjs';
import { floorTexture } from './art.mjs';

const HERO = 'Content.heroes[Sel]';
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));
const ID = `${HERO}.id`;
const PX = 'SceneWindowWidth() * 0.55';
const PW = 'SceneWindowWidth() * 0.43';

export function synaxisScene() {
  const objects = [
    ...heroBillboards(135, 18, [v.num('Index')]),
    cube('Floor', { w: 4000, h: 4000, d: 10, top: floorTexture('mosaic'), topRepeat: true, tileScale: 0.3, tint: '110;98;84' }),
    model('Candle', 'assets/models/candle.glb', { w: 34, h: 34, d: 60, anims: [['Idle', 'Idle']] }),
    model('Halo', 'assets/models/fx-glow.glb', { w: 220, h: 220, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter', anims: [['Idle', 'Idle']] }),
    particles('Motes', 'assets/particles/spark.png', { StartColor: '255;236;170', EndColor: '255;255;255', StartOpacity: 200, EndOpacity: 0, Flow: 24, StartSizeMin: 5, StartSizeMax: 12, EndScale: 0.2, StartSpeedMin: 10, StartSpeedMax: 40, LifespanMin: 2, LifespanMax: 5, Duration: -1, SpayConeAngle: 360, Gravity: -20, Blending: 'Additive', ShouldAutodestruct: false }),
  ];
  const instances = [
    instance('Floor', -2000, -2000, { z: -10, w: 4000, h: 4000, d: 10, locked: true }),
    ...[-700, -520, 520, 700].map(x => instance('Candle', x - 260, 120, { w: 34, h: 34, d: 60 })),
    instance('Motes', -260, 0, { z: 160 }),
  ];
  const baseX = i => `-560 + ${i} * 90`;
  const baseY = i => `-40 * abs(${i} - 3)`;
  const events = [
    link('UI'),
    bootEvents(),
    group('Scene', [
      comment('The seven stand in an arc; the chosen one steps forward into the light.'),
      ev([begins()], [
        set('Sel', '=', 'Content.heroIndex[Save.hero]'),
        A('SetCameraCenterX', '=', '-30', '""'), A('SetCameraCenterY', '=', '740', '""'),
        A('Scene3D::SetCameraZ', '=', '300', '""'), A('Scene3D::SetCameraRotationX', '=', '72', '""'),
        A('Psalm150::SetMood', q('menu'), q('chapel'), '0.2'),
        setS('Ui.top', '=', q('info')), setB('Rebuild', true),
        A('Create', 'Halo', '-260', '0', '""'), setZ('Halo', '2'),
      ], [
        ...applyQuality(),
        repeat('VariableChildCount(Content.heroes)', [], [
          A('CreateByName', 'Heroes', '"Hero_" + Content.heroes[i].id', baseX('i'), baseY('i'), '""'),
          oset('Heroes', 'Index', '=', 'i'),
        ], [], { index: 'i', vars: { i: 0 } }),
        ev([], [
          A('Create', 'UiArt', 'SceneWindowWidth() * 0.275', '78', q('UI')), anim('UiArt', 'christ-pantocrator'), size('UiArt', '130', '130'), osetS('UiArt', 'Key', '=', q('christ')),
        ]),
        ev([isB('Save.settings.veiled', true)], [], [ev([oisS('UiArt', 'Key', '=', q('christ'))], [A('Delete', 'UiArt')])]),
      ]),
      forEach('Heroes', [], [], [
        ev([ois('Heroes', 'Index', '=', 'Sel')], [
          A('SetXY', 'Heroes', '=', `lerp(Heroes.X(), ${baseX('Heroes.Index')}, min(1, 8 * TimeDelta()))`, '=', `lerp(Heroes.Y(), ${baseY('Heroes.Index')} + 90, min(1, 8 * TimeDelta()))`),
          scale('Heroes', '1.15'),
          A('SetXY', 'Halo', '=', 'Heroes.X()', '=', 'Heroes.Y()'),
        ]),
        ev([ois('Heroes', 'Index', '!=', 'Sel')], [
          A('SetXY', 'Heroes', '=', `lerp(Heroes.X(), ${baseX('Heroes.Index')}, min(1, 8 * TimeDelta()))`, '=', `lerp(Heroes.Y(), ${baseY('Heroes.Index')}, min(1, 8 * TimeDelta()))`),
          scale('Heroes', '0.92'),
        ]),
      ]),
    ]),
    group('Choosing', [
      ev([isS('Ui.top', '=', q('info')), OR(keyJust('Left'), keyJust('a'))], [setS('Ui.clicked', '=', q('prev'))]),
      ev([isS('Ui.top', '=', q('info')), OR(keyJust('Right'), keyJust('d'))], [setS('Ui.clicked', '=', q('next'))]),
      ev([isS('Ui.top', '=', q('info')), keyJust('Return')], [setS('Ui.clicked', '=', q('choose'))]),
      ev([clicked('close')], [setS('Ui.clicked', '=', q('back'))]),
      ev([clicked('prev')], [set('Sel', '=', 'mod(Sel - 1 + 7, 7)'), setB('Rebuild', true)]),
      ev([clicked('next')], [set('Sel', '=', 'mod(Sel + 1, 7)'), setB('Rebuild', true)]),
      comment('A click on an archangel chooses him (the cursor is projected on the ground of the 3D layer).'),
      ev([isS('Ui.top', '=', q('info')), C('MouseButtonFromTextReleased', q('Left')), NOT(C('IsCursorOnObject', 'UiPanel')), NOT(C('IsCursorOnObject', 'UiButton'))], [], [
        ev([C('PickNearest', 'Heroes', 'CursorX("")', 'CursorY("")'), cmp('Heroes.DistanceToPosition(CursorX(""), CursorY(""))', '<', '110')], [set('Sel', '=', 'Heroes.Index'), setB('Rebuild', true), sfx('click')]),
      ]),
      ev([clicked('choose'), C('HolyHoly::IsHeroOpen', ID)], [
        setS('Save.hero', '=', ID), setS('Run.hero', '=', ID), setB('Run.trial', false), store(),
        setS('Run.story', '=', q('intro')), setS('Run.next', '=', q('Arena')), sfx('door'),
        scene('Story'),
      ]),
      ev([clicked('choose'), NOT(C('HolyHoly::IsHeroOpen', ID))], [sfx('weaken')]),
      ev([clicked('try'), NOT(C('HolyHoly::IsHeroOpen', ID)), isB(`Save.trials[${ID}]`, false)], [
        setB(`Save.trials[${ID}]`, true), setS('Run.hero', '=', ID), setB('Run.trial', true), store(),
        setS('Run.story', '=', q('intro')), setS('Run.next', '=', q('Arena')), sfx('door'),
        scene('Story'),
      ]),
      ev([clicked('back')], [scene('Ladder')]),
    ]),
    group('Archangel card', [
      comment('Everything about the chosen archangel: name and meaning, the tradition that names him, his lore, his gift, his prayer, his trait, and how he is unlocked.'),
      ev([isB('Rebuild', true)], [setB('Rebuild', false)], [
        ...closePanel('info'),
        ev([], [
          A('HolyHoly::MakePanel', 'UiPanel', PX, '20', PW, 'SceneWindowHeight() - 40', q(''), q('info'), q('UI')),
          label('UiTitle', `${PX} + 30`, '36', `${PW} - 60`, '', { panel: 'info', expr: `${HERO}.name` }),
          label('UiSmall', `${PX} + 32`, '96', `${PW} - 64`, '', { panel: 'info', key: 'meaning', expr: `"„" + ${HERO}.meaning + "” · " + ${HERO}.skill` }),
          label('UiSmall', `${PX} + 32`, '150', `${PW} - 64`, '', { panel: 'info', expr: `${HERO}.lore` }),
          A('Create', 'UiArt', `${PX} + 66`, '290', q('UI')), animE('UiArt', `"sig-" + ${ID} + "-2"`), size('UiArt', '68', '68'), osetS('UiArt', 'Panel', '=', q('info')), A('SetZOrder', 'UiArt', '=', '60'),
          label('UiText', `${PX} + 112`, '256', `${PW} - 140`, '', { panel: 'info', expr: `"Dar: " + Content.skills["sig-" + ${ID}].name` }),
          label('UiSmall', `${PX} + 112`, '290', `${PW} - 140`, '', { panel: 'info', expr: `Content.skills["sig-" + ${ID}].description` }),
          A('Create', 'UiArt', `${PX} + 66`, '392', q('UI')), animE('UiArt', `"ult-" + ${ID}`), size('UiArt', '68', '68'), osetS('UiArt', 'Panel', '=', q('info')), A('SetZOrder', 'UiArt', '=', '60'),
          label('UiText', `${PX} + 112`, '358', `${PW} - 140`, '', { panel: 'info', expr: `"Modlitwa: " + ${HERO}.ultimate.name` }),
          label('UiSmall', `${PX} + 112`, '392', `${PW} - 140`, '', { panel: 'info', expr: `${HERO}.ultimate.text` }),
          label('UiSmall', `${PX} + 32`, '466', `${PW} - 64`, '', { panel: 'info', expr: `"Cecha: " + ${HERO}.passive.name + ". " + ${HERO}.passive.text` }),
          label('UiSmall', `${PX} + 32`, '508', `${PW} - 64`, '', { panel: 'info', key: 'verse', expr: `"„" + ${HERO}.verse.text + "” (" + ${HERO}.verse.ref + ")"` }),
          label('UiSmall', `${PX} + 32`, 'SceneWindowHeight() - 132', `${PW} - 64`, '', { panel: 'info', key: 'status' }),
          button(`${PX} + 30`, 'SceneWindowHeight() - 96', '64', '52', '◀', 'prev', { panel: 'info' }),
          button(`${PX} + 102`, 'SceneWindowHeight() - 96', '64', '52', '▶', 'next', { panel: 'info' }),
          button(`${PX} + ${PW} - 132`, 'SceneWindowHeight() - 96', '110', '52', 'Wróć', 'back', { panel: 'info' }),
        ]),
        ev([C('HolyHoly::IsHeroOpen', ID)], [button(`${PX} + 182`, 'SceneWindowHeight() - 100', '220', '58', 'Wybierz', 'choose', { panel: 'info' })]),
        ev([NOT(C('HolyHoly::IsHeroOpen', ID)), isB(`Save.trials[${ID}]`, false)], [button(`${PX} + 182`, 'SceneWindowHeight() - 100', '220', '58', 'Wypróbuj (raz)', 'try', { panel: 'info' })]),
        ev([oisS('UiPanel', 'Panel', '=', q('info'))], [A('SetZOrder', 'UiPanel', '=', '40')]),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('meaning')), isS(`${HERO}.tradition`, '=', q('wschodnia'))], [text('UiSmall', `"„" + ${HERO}.meaning + "” · imię w tradycji wschodniej (prawosławnej i wschodniokatolickiej)"`)]),
      ev([oisS('UiSmall', 'Key', '=', q('meaning')), isS(`${HERO}.tradition`, '=', q('wspólna'))], [text('UiSmall', `"„" + ${HERO}.meaning + "” · czczony w całym Kościele, na Wschodzie i na Zachodzie"`)]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), C('HolyHoly::IsHeroOpen', ID)], [text('UiSmall', q('Gotów do drogi.'))]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), NOT(C('HolyHoly::IsHeroOpen', ID)), isB(`Save.trials[${ID}]`, false)], [text('UiSmall', `"Dołączy na stałe po rozdziale „" + ${HERO}.unlockedByTitle + "”. Już teraz możesz go raz wypróbować."`)]),
      ev([oisS('UiSmall', 'Key', '=', q('status')), NOT(C('HolyHoly::IsHeroOpen', ID)), isB(`Save.trials[${ID}]`, true)], [text('UiSmall', `"Dołączy na stałe po rozdziale „" + ${HERO}.unlockedByTitle + "” (próba wykorzystana)."`)]),
    ]),
  ];
  return {
    name: 'Synaxis',
    background: [22, 18, 14],
    layers: lightingLayers({ fog: '22;18;14', near: 1200, far: 3400, sky: '255;244;220', ground: '110;90;60', sun: 0.85, hemi: 0.7 }),
    objects,
    instances,
    events,
    variables: [v.num('Sel'), v.bool('Rebuild')],
    groups: [['Heroes', HERO_IDS.map(id => `Hero_${id}`)]],
  };
}
