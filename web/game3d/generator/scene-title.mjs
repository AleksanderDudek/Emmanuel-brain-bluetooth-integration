// Title scene: the chosen archangel in a quiet garden, the menu and its panels: the person under
// the angel's protection (a man or a woman, and a name), how to play, the Mendi band, settings,
// help and safety, and support for the author.
import { A, C, NOT, OR, ev, group, comment, q, set, setS, setB, isS, isB, cmp, cmpS, oisS, ois, oset, osetS, text, keyJust, link, begins, scene, anim, animE, opacity, size } from './dsl.mjs';
import { model, cube, particles, layer, effect, instance, v } from './objects.mjs';
import { defaultObject } from './gd.mjs';
import { button, label, box, closePanel, sfx, clicked, settingsPanel, settingsEvents, SAVE_KEY, HERO_IDS } from './ui.mjs';
import { FONT_TEXT } from './objects.mjs';
import { aspectOf, foreshortening, paintingOf, floorTexture } from './art.mjs';

const P = name => [setS('Ui.top', '=', q(name))];
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));

export function lightingLayers({ fog = '20;16;34', near = 900, far = 3200, sky = '255;246;230', ground = '90;80;110', sun = 0.8, hemi = 0.55 } = {}) {
  return [
    layer('', {
      effects: [
        effect('Scene3D::HemisphereLight', 'Sky', { elevation: 60, intensity: hemi, rotation: 300 }, { groundColor: ground, skyColor: sky, top: 'Z+' }),
        effect('Scene3D::DirectionalLight', 'Sun', { distanceFromCamera: 1500, elevation: 55, frustumSize: 3000, intensity: sun, minimumShadowBias: 0, rotation: 300, shadowDistance: 2200 }, { color: '255;240;214', shadowQuality: 'medium', shadowRenderingMode: 'fittedToCameraView', top: 'Z+' }, { isCastingShadow: true }),
        effect('Scene3D::LinearFog', 'Fog', { near, far }, { color: fog }),
        effect('Scene3D::Bloom', 'Glow', { strength: 0.5, radius: 0.35, threshold: 0.88 }),
      ],
    }),
    layer('UI', { rendering: '2d' }),
  ];
}

/** Turn bloom and shadows on or off by the player's setting ("lekka" graphics for phones). */
export const applyQuality = () => [
  ev([isB('Save.settings.effects', true)], [A('EnableLayerEffect', '""', q('Glow'), 'yes'), A('SetLayerEffectBooleanParameter', '""', q('Sun'), q('isCastingShadow'), 'yes')]),
  ev([isB('Save.settings.effects', false)], [A('EnableLayerEffect', '""', q('Glow'), 'no'), A('SetLayerEffectBooleanParameter', '""', q('Sun'), q('isCastingShadow'), 'no')]),
];

/** Load content and save once per game (the first scene that runs does it). */
export const bootEvents = () => group('Boot', [
  comment('The content (chapters, archangels, shadow-thoughts, gifts…) comes from assets/data/content.json, built by tools/build-content.mjs. The save lives in the browser storage and is merged over the defaults of the global variable Save.'),
  ev([begins(), NOT(C('HolyHoly::IsGlobalLoaded', q('Content')))], [
    A('HolyHoly::LoadJsonIntoGlobal', 'assets/data/content.json', q('Content')),
    A('HolyHoly::LoadSave', q('Save'), q(SAVE_KEY)),
  ]),
  ev([begins()], [A('HolyHoly::ExposeForTests'), A('Psalm150::SetVolumes', 'Save.settings.master', 'Save.settings.music', 'Save.settings.sfx')]),
]);

/** The seven archangels as billboards for a camera looking down at `elevation` degrees. */
export const heroBillboards = (w, elevation, vars = []) => HERO_IDS.map(id => model(`Hero_${id}`, `assets/models/hero-${id}.glb`, {
  w, h: Math.round(w * 0.4), d: Math.round(w * aspectOf(paintingOf(`hero-${id}`)) * foreshortening(elevation)),
  keepAspect: false, castShadow: false, receiveShadow: false, anims: [['Idle', 'Idle']], vars: vars.map(x => ({ ...x })),
}));

function nameInput() {
  const o = defaultObject('TextInput::TextInputObject');
  o.name = 'UiInput';
  Object.assign(o.content, {
    initialValue: '', placeholder: 'Imię', fontResourceName: FONT_TEXT, fontSize: 26, textColor: '30;22;14', fillColor: '250;244;228', fillOpacity: 255,
    borderColor: '200;160;80', borderOpacity: 255, borderWidth: 2, maxLength: 24, paddingX: 10, paddingY: 4, textAlign: 'center',
  });
  o.variables = [];
  o.behaviors = [];
  return o;
}

export function titleScene() {
  const objects = [
    ...heroBillboards(300, 16),
    cube('Garden', { w: 4000, h: 4000, d: 10, top: floorTexture('mosaic'), topRepeat: true, tileScale: 0.3, tint: '96;88;96' }),
    model('Column', 'assets/models/column.glb', { w: 120, h: 120, d: 240 }),
    model('Candle', 'assets/models/candle.glb', { w: 40, h: 40, d: 70, anims: [['Idle', 'Idle']] }),
    model('Orb', 'assets/models/orb-done.glb', { w: 70, h: 70, d: 90, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Phase')] }),
    particles('Motes', 'assets/particles/soft.png', { StartColor: '255;230;160', EndColor: '255;250;230', StartOpacity: 200, EndOpacity: 0, Flow: 14, StartSizeMin: 6, StartSizeMax: 14, EndScale: 0.3, StartSpeedMin: 10, StartSpeedMax: 40, LifespanMin: 3, LifespanMax: 6, Duration: -1, SpayConeAngle: 360, Gravity: -12, Blending: 'Additive', ShouldAutodestruct: false }),
    nameInput(),
  ];
  const instances = [
    instance('Garden', -2000, -2000, { z: -10, w: 4000, h: 4000, d: 10, locked: true }),
    ...[-1, 1].flatMap(s => [instance('Column', s * 330, -160, { w: 120, h: 120, d: 240 }), instance('Column', s * 470, 60, { w: 120, h: 120, d: 240 })]),
    ...[-260, -150, 150, 260].map((x, i) => instance('Candle', x, 170 + (i % 2) * 40, { w: 40, h: 40, d: 70 })),
    instance('Motes', 0, 0, { z: 120 }),
  ];
  const X = w => `(SceneWindowWidth() - ${w}) / 2`;
  const events = [
    link('UI'),
    bootEvents(),
    comment('A panel that hands over to the next step (the first "Graj") does it here, at the top of the next frame, so the step\'s own events see the click.'),
    ev([isS('Pending', '!=', '""')], [setS('Ui.clicked', '=', 'Pending'), setS('Pending', '=', '""')]),
    group('Scene', [
      ev([begins()], [
        A('SetCameraCenterX', '=', '-360', '""'),
        A('SetCameraCenterY', '=', '860', '""'),
        A('Scene3D::SetCameraZ', '=', '400', '""'),
        A('Scene3D::SetCameraRotationX', '=', '74', '""'),
        A('Psalm150::SetMood', q('menu'), q('menu'), '0.12'),
        A('CreateByName', 'Heroes', '"Hero_" + Save.hero', '0', '0', '""'),
        setS('Ui.top', '=', '""'),
      ], applyQuality()),
      ev([begins()], [], [
        ...[0, 1, 2, 3, 4, 5].map(i => ev([], [A('Create', 'Orb', `cos(ToRad(${i * 60})) * 230`, `sin(ToRad(${i * 60})) * 230`, '""'), A('Scene3D::Base3DBehavior::SetZ', 'Orb', 'Object3D', '=', '150'), A('SetNumberObjectVariable', 'Orb', 'Phase', '=', String(i * 60))])),
      ]),
      ev([], [
        A('SetNumberObjectVariable', 'Orb', 'Phase', '+', '20 * TimeDelta()'),
        A('SetXY', 'Orb', '=', 'cos(ToRad(Orb.Phase)) * 230', '=', 'sin(ToRad(Orb.Phase)) * 150 - 40'),
        A('Scene3D::Base3DBehavior::SetZ', 'Orb', 'Object3D', '=', '200 + sin(ToRad(Orb.Phase * 3)) * 25'),
      ]),
    ]),
    group('Menu', [
      comment('The menu sits on the left; the archangel stands on the right. Every panel sets Ui.top so only its buttons answer. The first "Graj" walks through: who you protect, how to play, the prologue.'),
      ev([begins()], [
        label('UiTitle', '70', '56', 620, '', { h: 56, expr: 'Content.title.name' }),
        label('UiText', '74', '118', 600, '', { h: 36, expr: 'Content.title.subtitle + ": siedmiu stróżów, jedna historia"' }),
        label('UiSmall', '74', '160', 560, '', { h: 76, expr: '"„" + Content.title.motto.text + "” (" + Content.title.motto.ref + ")"' }),
        button('70', '250', '330', '58', 'Graj', 'play'),
        button('70', '318', '330', '54', 'Kogo strzeżesz', 'profile'),
        button('70', '382', '330', '54', 'Jak grać', 'howto'),
        button('70', '446', '330', '54', 'Opaska Mendi', 'band'),
        button('70', '510', '330', '54', 'Ustawienia', 'settings'),
        button('70', '574', '330', '54', 'Pomoc i bezpieczeństwo', 'help'),
        button('70', '638', '330', '54', 'Wesprzyj twórcę ☕', 'support'),
        label('UiSmall', 'SceneWindowWidth() - 700', 'SceneWindowHeight() - 44', 660, '', { key: 'rank', align: 'right' }),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('rank'))], [text('UiSmall', '"Strzeżesz: " + HolyHoly::G("{imie}") + " · ranga: " + HolyHoly::RankName(Save.light) + " · światło " + ToString(Save.light)')]),
      ev([keyJust('Return'), isS('Ui.top', '=', '""')], [setS('Ui.clicked', '=', q('play'))]),
      ev([clicked('play')], [setB('Flow', true)]),
      ev([clicked('play'), isB('Save.settings.seenDisclaimer', false)], [setS('Ui.clicked', '=', q('help'))]),
      ev([clicked('play'), isB('Save.settings.seenDisclaimer', true), isB('Save.profile.set', false)], [setS('Ui.clicked', '=', q('profile'))]),
      ev([clicked('play'), isB('Save.settings.seenDisclaimer', true), isB('Save.profile.set', true), isB('Save.settings.seenHowTo', false)], [setS('Ui.clicked', '=', q('howto'))]),
      ev([clicked('play'), isB('Save.settings.seenDisclaimer', true), isB('Save.profile.set', true), isB('Save.settings.seenHowTo', true)], [setS('Ui.clicked', '=', q('go'))]),
      ev([clicked('go'), isB('Save.settings.seenPrologue', false)], [setS('Run.story', '=', q('prologue')), setS('Run.next', '=', q('Ladder')), set('Run.chapter', '=', '0'), scene('Story')]),
      ev([clicked('go'), isB('Save.settings.seenPrologue', true)], [scene('Ladder')]),
    ]),
    group('Panels', [
      ev([clicked('close')], [setS('Ui.top', '=', '""')], [
        ...['howto', 'band', 'settings', 'help', 'support', 'profile'].flatMap(p => closePanel(p)),
        ev([], [A('Delete', 'UiInput')]),
      ]),
      comment('First launch: a gentle word that this is a game of hope, not therapy, with real help lines.'),
      ev([begins(), isB('Save.settings.seenDisclaimer', false)], [setS('Ui.clicked', '=', q('help'))]),
      ev([clicked('help')], [
        ...P('help'),
        box(X(820), '30', '820', 'SceneWindowHeight() - 60', { panel: 'help' }),
        label('UiTitle', X(820), '48', 820, 'Zanim zaczniesz', { align: 'center', panel: 'help' }),
        label('UiSmall', X(740), '112', 740, '', { panel: 'help', h: 180, expr: 'Content.story.disclaimer' }),
        label('UiSmall', X(740), '300', 740, '', { panel: 'help', h: 'SceneWindowHeight() - 420', expr: '"Jeśli przeżywasz kryzys, nie zostawaj z tym sam na sam. Pomoc w Polsce (bezpłatnie):" + NewLine() + NewLine() + Content.story.helplinesText' }),
        button('(SceneWindowWidth() - 240) / 2', 'SceneWindowHeight() - 100', '240', '56', 'Rozumiem', 'helpDone', { panel: 'help' }),
      ]),
      ev([clicked('helpDone')], [setB('Save.settings.seenDisclaimer', true), store(), setS('Ui.top', '=', '""')], [
        ...closePanel('help'),
        ev([isB('Flow', true)], [setS('Pending', '=', q('play'))]),
      ]),
      ev([clicked('howto')], [
        ...P('howto'),
        box(X(860), '40', '860', '640', { panel: 'howto' }),
        label('UiTitle', X(860), '60', 860, 'Jak grać', { align: 'center', panel: 'howto' }),
        label('UiSmall', X(780), '120', 780, '', { panel: 'howto', h: 400, expr: 'Content.story.howToText' }),
        label('UiSmall', X(780), '530', 780, 'Nie ma końca gry: gdy cienie przytłoczą, Ktoś poda rękę i wstaniesz. Między etapami zobaczysz, jak kłamie jedna myśl i co jest prawdą; na końcu dostaniesz narzędzie na co dzień.', { panel: 'howto', h: 72 }),
        button('(SceneWindowWidth() - 240) / 2', '610', '240', '56', 'Do dzieła', 'howtoDone', { panel: 'howto' }),
      ]),
      ev([clicked('howtoDone')], [setB('Save.settings.seenHowTo', true), store(), setS('Ui.top', '=', '""')], [
        ...closePanel('howto'),
        ev([isB('Flow', true)], [setS('Pending', '=', q('play'))]),
      ]),
      ev([clicked('band')], [
        ...P('band'),
        box(X(760), '70', '760', '580', { panel: 'band' }),
        label('UiTitle', X(760), '94', 760, 'Opaska Mendi', { align: 'center', panel: 'band' }),
        label('UiSmall', X(680), '160', 680, 'Opaska fNIRS Mendi mierzy pracę kory przedczołowej. W grze nie jest potrzebna: skupienie daje też bezruch. Z opaską skupienie liczy się nawet w ruchu, a modlitwa archanioła ładuje się szybciej. Dane zostają w urządzeniu. To nie jest wyrób medyczny ani terapia.', { panel: 'band' }),
        label('UiText', X(680), '360', 680, '', { key: 'bandStatus', panel: 'band', align: 'center' }),
        button('(SceneWindowWidth() - 560) / 2', '470', '270', '58', 'Połącz opaskę', 'connect', { panel: 'band' }),
        button('(SceneWindowWidth() + 20) / 2', '470', '270', '58', 'Rozłącz', 'disconnect', { panel: 'band' }),
        button('(SceneWindowWidth() - 240) / 2', '565', '240', '56', 'Zamknij', 'close', { panel: 'band' }),
      ]),
      ev([oisS('UiText', 'Key', '=', q('bandStatus'))], [text('UiText', 'MendiFocus::StatusText()')]),
      ev([clicked('connect')], [A('MendiFocus::Connect')]),
      ev([clicked('disconnect')], [A('MendiFocus::Disconnect')]),
      ev([clicked('settings')], [...P('settings'), ...settingsPanel('settings')]),
      settingsEvents(),
      ev([clicked('effects')], [], applyQuality()),
      comment('Support: a plain link, never inside the game itself, never next to the image of Christ.'),
      ev([clicked('support')], [
        ...P('support'),
        box(X(720), '120', '720', '460', { panel: 'support' }),
        label('UiTitle', X(720), '144', 720, '', { align: 'center', panel: 'support', expr: 'Content.story.support.title' }),
        label('UiText', X(620), '220', 620, '', { panel: 'support', align: 'center', expr: 'Content.story.support.text' }),
        label('UiSmall', X(620), '400', 620, '', { panel: 'support', align: 'center', expr: 'Content.story.support.url' }),
        button('(SceneWindowWidth() - 560) / 2', '480', '270', '58', '', 'coffee', { panel: 'support', captionExpr: 'Content.story.support.button' }),
        button('(SceneWindowWidth() + 20) / 2', '480', '270', '58', 'Zamknij', 'close', { panel: 'support' }),
      ]),
      ev([clicked('coffee')], [A('LaunchFile', 'Content.story.support.url')]),
    ]),
    profileEvents(),
  ];
  return {
    name: 'Title',
    background: [18, 14, 30],
    layers: lightingLayers(),
    objects,
    instances,
    events,
    variables: [v.bool('Flow'), v.str('Pending')],
    groups: [['Heroes', HERO_IDS.map(id => `Hero_${id}`)]],
  };
}

/** Who the angel protects: a man or a woman (texts follow: „Jestem kochany” / „Jestem kochana”) and a name. */
function profileEvents() {
  const W = 900, X = `(SceneWindowWidth() - ${W}) / 2`;
  const portrait = (who, dx) => [
    A('Create', 'UiArt', `${X} + ${dx}`, '330', q('UI')), anim('UiArt', `person-${who}`), size('UiArt', '150', '225'),
    osetS('UiArt', 'Panel', '=', q('profile')), osetS('UiArt', 'Key', '=', q(`person-${who}`)), A('SetZOrder', 'UiArt', '=', '280'),
  ];
  return group('Who you protect', [
    comment('The person under the angel\'s protection: the player can give them their own name. Gender sets the Polish forms of every text ({a|b} in the content, HolyHoly::G).'),
    ev([clicked('profile')], [
      ...P('profile'),
      box(X, '24', W, '680', { panel: 'profile' }),
      label('UiTitle', X, '40', W, 'Kogo strzeżesz?', { align: 'center', panel: 'profile' }),
      label('UiSmall', `${X} + 50`, '100', W - 100, 'Bóg powierza ci człowieka. To jego albo jej historia: współczesna, polska, prawdziwa. Możesz nadać tej osobie swoje imię.', { align: 'center', panel: 'profile' }),
      ...portrait('m', 230),
      ...portrait('f', W - 230),
      button(`${X} + 130`, '452', '200', '50', 'Mężczyzna', 'gender', { panel: 'profile', arg: 0 }),
      button(`${X} + ${W - 330}`, '452', '200', '50', 'Kobieta', 'gender', { panel: 'profile', arg: 1 }),
      label('UiText', `${X} + 230`, '528', 160, 'Imię:', { panel: 'profile', align: 'right' }),
      A('Create', 'UiInput', `${X} + 410`, '522', q('UI')),
      A('ResizableCapability::ResizableBehavior::SetSize', 'UiInput', 'Resizable', '280', '46'),
      A('TextContainerCapability::TextContainerBehavior::SetValue', 'UiInput', 'Text', '=', 'HolyHoly::G("{imie}")'),
      label('UiSmall', `${X} + 60`, '584', W - 120, '', { panel: 'profile', align: 'center', key: 'profileHint' }),
      button(`${X} + ${W / 2 - 120}`, '632', '240', '56', 'Gotowe', 'profileDone', { panel: 'profile' }),
    ]),
    ev([oisS('UiSmall', 'Key', '=', q('profileHint'))], [text('UiSmall', 'HolyHoly::G("Teksty dopasują się do ciebie: „Jestem {kochany|kochana}”, „{Popełniłem|Popełniłam} błąd, ale nie jestem błędem”.")')]),
    ev([oisS('UiArt', 'Panel', '=', q('profile'))], [opacity('UiArt', '110')]),
    ev([oisS('UiArt', 'Key', '=', q('person-m')), isS('Save.profile.gender', '=', q('m'))], [opacity('UiArt', '255')]),
    ev([oisS('UiArt', 'Key', '=', q('person-f')), isS('Save.profile.gender', '=', q('f'))], [opacity('UiArt', '255')]),
    ev([clicked('gender')], [], [
      ev([cmp('Ui.arg', '=', '0')], [setS('Save.profile.gender', '=', q('m'))]),
      ev([cmp('Ui.arg', '=', '1')], [setS('Save.profile.gender', '=', q('f'))]),
      comment('A default name follows the choice (Adam ↔ Ewa); a name the player typed stays.'),
      ev([OR(cmpS('UiInput.Text::Value()', '=', 'Content.story.names.m'), cmpS('UiInput.Text::Value()', '=', 'Content.story.names.f'), cmpS('UiInput.Text::Value()', '=', '""'))], [
        A('TextContainerCapability::TextContainerBehavior::SetValue', 'UiInput', 'Text', '=', 'HolyHoly::G("{Adam|Ewa}")'),
      ]),
    ]),
    ev([clicked('profileDone')], [
      setS('Save.profile.name', '=', 'UiInput.Text::Value()'),
      setB('Save.profile.set', true),
      store(), setS('Ui.top', '=', '""'), A('Delete', 'UiInput'),
    ], [
      comment('A default name is not stored, so it keeps following the gender.'),
      ev([OR(isS('Save.profile.name', '=', 'Content.story.names.m'), isS('Save.profile.name', '=', 'Content.story.names.f'))], [setS('Save.profile.name', '=', '""'), store()]),
      ...closePanel('profile'),
      ev([isB('Flow', true)], [setS('Pending', '=', q('play'))]),
    ]),
  ]);
}
