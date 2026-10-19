// Revelation: after the healing scene, the person does the inner work. A thought record (the
// situation, the lie, the feeling, the thinking error) asks how to answer the lie: three answers,
// one distorted, one sugar-coated, one balanced; only the balanced one transforms it. Then the
// truth and a verse, the skill to take into life (with a challenge for today), the report and
// the rewards, an archangel who joins, and after the last chapter the finale.
import { A, C, NOT, OR, ev, group, comment, q, set, setS, setB, is, isS, isB, cmp, cmpS, oisS, ois, oset, osetS, text, keyJust, link, begins, scene, animE, anim, setZ, width, size, tint, opacity, tweenOpacity, tweenWidth, forEachChild, repeat, dt } from './dsl.mjs';
import { model, cube, particles, instance, v } from './objects.mjs';
import { button, label, box, closePanel, sfx, clicked, SAVE_KEY, HERO_IDS, breathingPanel, breathingEvents } from './ui.mjs';
import { lightingLayers, applyQuality, bootEvents, heroBillboards } from './scene-title.mjs';
import { aspectOf, foreshortening, paintingOf, floorTexture } from './art.mjs';

const CH = 'Content.chapters[Run.chapter]';
const CBT = `${CH}.cbt`;
const G = t => `HolyHoly::G(${t})`;
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));
const X0 = 'SceneWindowWidth() * 0.4';
const TW = 'SceneWindowWidth() * 0.56';
const ELEVATION = 18;

/** Show the UI of a page step by step: every element starts transparent and fades in at its time. */
const reveal = (k, at) => ev([oisS('UiAll', 'Key', '=', q(k)), cmp('T', '>=', at), ois('UiAll', 'Index', '=', '0')], [oset('UiAll', 'Index', '=', '1'), tweenOpacity('UiAll', 'in', '255', '0.6')]);

const person = (who, file) => model(`Person_${who}`, `assets/models/person-${who}.glb`, {
  w: 120, h: 50, d: Math.round(120 * aspectOf(file) * foreshortening(ELEVATION)), keepAspect: false, castShadow: false, receiveShadow: false, anims: [['Idle', 'Idle']],
});

export function revelationScene() {
  const objects = [
    ...heroBillboards(210, ELEVATION),
    person('m', 'people/man.webp'),
    person('f', 'people/woman.webp'),
    cube('Floor', { w: 3000, h: 3000, d: 10, top: floorTexture('mosaic'), topRepeat: true, tileScale: 0.3, tint: '140;128;108' }),
    model('Light', 'assets/models/fx-glow.glb', { w: 520, h: 520, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter', anims: [['Idle', 'Idle']] }),
    model('Candle', 'assets/models/candle.glb', { w: 40, h: 40, d: 70, anims: [['Idle', 'Idle']] }),
    particles('Motes', 'assets/particles/spark.png', { StartColor: '255;236;170', EndColor: '255;255;255', StartOpacity: 220, EndOpacity: 0, Flow: 40, StartSizeMin: 6, StartSizeMax: 16, EndScale: 0.2, StartSpeedMin: 20, StartSpeedMax: 70, LifespanMin: 2, LifespanMax: 4, Duration: -1, SpayConeAngle: 360, Gravity: -30, Blending: 'Additive', ShouldAutodestruct: false }),
  ];
  const instances = [
    instance('Floor', -1500, -1500, { z: -10, w: 3000, h: 3000, d: 10, locked: true }),
    instance('Light', -20, 10, { z: 2, w: 520, h: 520, d: 2 }),
    instance('Candle', -260, 160, { w: 40, h: 40, d: 70 }), instance('Candle', 220, 160, { w: 40, h: 40, d: 70 }),
    instance('Motes', 0, 0, { z: 140 }),
  ];
  const head = (title, k = 'h') => [
    box(`${X0} - 30`, '24', `${TW} + 50`, 'SceneWindowHeight() - 48', { key: `${k}bg`, panel: 'page' }),
    label('UiTitle', X0, '40', TW, title, { key: `${k}a`, panel: 'page' }),
  ];
  const cbtPage = [
    ...head('Przemiana myśli', 'c'),
    label('UiSmall', X0, '100', TW, '', { key: 'c1', panel: 'page', expr: `"Sytuacja: " + ${G(`${CBT}.situation`)}` }),
    label('UiText', X0, '134', TW, '', { key: 'c2', panel: 'page', expr: `"Myśl: „" + ${G(`${CBT}.thought`)} + "”"` }),
    label('UiSmall', X0, '204', TW, '', { key: 'c3', panel: 'page', expr: `"Uczucie: " + ${G(`${CBT}.feeling`)} + " · jak kłamie: " + ${G(`Content.distortions[${G(`${CBT}.distortion`)}].name`)}` }),
    label('UiSmall', X0, '240', TW, '', { key: 'c4', panel: 'page', expr: `"Pytanie: " + ${G(`Content.distortions[${G(`${CBT}.distortion`)}].question`)} + " Jak odpowiesz tej myśli?"` }),
  ];
  const truthPage = [
    ...head('Prawda', 't'),
    label('UiText', X0, '104', TW, '', { key: 't1', panel: 'page', expr: `"Kłamstwo: „" + ${G(`${CBT}.thought`)} + "”"` }),
    label('UiText', X0, '200', TW, '', { key: 't2', panel: 'page', expr: G(`${CBT}.truth`) }),
    label('UiSmall', X0, '360', TW, '', { key: 't3', panel: 'page', expr: `"„" + ${G(`${CBT}.verse.text`)} + "” (" + ${G(`${CBT}.verse.ref`)} + ")"` }),
    label('UiSmall', X0, '460', TW, '', { key: 't4', panel: 'page', expr: '"Przemienionych myśli w tym rozdziale: " + ToString(Run.reframes) + " · rozeznanych kłamstw: " + ToString(Run.discRight)' }),
    button(`${X0} + ${TW} - 220`, 'SceneWindowHeight() - 100', '220', '56', 'Dalej', 'next', { panel: 'page' }),
  ];
  const toolPage = [
    ...head('Narzędzie na drogę', 'o'),
    label('UiText', X0, '100', TW, '', { key: 'o1', panel: 'page', expr: `${CH}.tool.name` }),
    label('UiSmall', X0, '140', TW, '', { key: 'o2', panel: 'page', expr: G(`${CH}.tool.summary`) }),
    label('UiSmall', X0, '200', TW, '', { key: 'steps', panel: 'page' }),
    label('UiSmall', X0, '420', TW, '', { key: 'o3', panel: 'page', expr: `"Wyzwanie na dziś: " + ${G(`${CH}.tool.practice`)}` }),
    label('UiSmall', X0, '490', TW, '', { key: 'o4', panel: 'page', expr: `"Co mówią badania: " + ${CH}.tool.evidence` }),
    button(`${X0} + ${TW} - 220`, 'SceneWindowHeight() - 100', '220', '56', 'Dalej', 'next', { panel: 'page' }),
  ];
  const reportPage = [
    ...head('Raport dla Tronu', 'r'),
    label('UiSmall', X0, '104', TW, '', { key: 'r1', panel: 'page', expr: '"Przemienione myśli: " + ToString(Run.reframes) + NewLine() + "Rozeznane kłamstwa: " + ToString(Run.discRight) + NewLine() + "Najdłuższa seria ciosów: ×" + ToString(Run.bestCombo) + NewLine() + "Najdłuższe czuwanie: " + ToString(round(Run.focusHeld)) + " s" + NewLine() + "Upadki i powstania: " + ToString(Run.falls) + NewLine() + "Poziom: " + ToString(Run.level) + " · czas: " + HolyHoly::Clock(Run.time)' }),
    label('UiText', X0, '300', TW, '', { key: 'r2', panel: 'page', expr: '"Światło: +" + ToString(round(Run.light)) + "   ·   manna: +" + ToString(Run.manna)' }),
    label('UiText', X0, '346', TW, '', { key: 'r3', panel: 'page' }),
    label('UiText', X0, '410', TW, '', { key: 'r4', panel: 'page' }),
    button(`${X0} + ${TW} - 240`, 'SceneWindowHeight() - 100', '240', '56', 'Do Drabiny', 'done', { panel: 'page' }),
  ];
  const finalePage = [
    ...head('Święty, Święty, Święty', 'f'),
    label('UiSmall', X0, '100', TW, '', { key: 'f1', panel: 'page', expr: `${G('Content.story.finale[0]')} + NewLine() + NewLine() + ${G('Content.story.finale[1]')} + NewLine() + NewLine() + ${G('Content.story.finale[2]')}` }),
    label('UiText', X0, '400', TW, '', { key: 'f2', panel: 'page', expr: G('Content.story.finale[3]') }),
    label('UiSmall', X0, '500', TW, '', { key: 'f3', panel: 'page', expr: 'Content.story.support.text' }),
    button(X0, 'SceneWindowHeight() - 100', '260', '56', '', 'coffee', { panel: 'page', captionExpr: 'Content.story.support.button' }),
    button(`${X0} + ${TW} - 240`, 'SceneWindowHeight() - 100', '240', '56', 'Do Drabiny', 'done', { panel: 'page' }),
  ];
  const events = [
    link('UI'),
    bootEvents(),
    group('Rewards', [
      comment('The chapter is done: light joins the lifetime total (ranks), manna is given (more the first time), the tool is kept in the toolbox, an archangel may join.'),
      ev([begins()], [
        setB('Run.firstTime', true),
        setS('Run.oldRank', '=', 'HolyHoly::RankName(Save.light)'),
        set('Run.manna', '=', '20 + 6 * Run.chapter + floor(Run.light / 40)'),
        setS('Run.unlocked', '=', '""'),
        setS('Ui.top', '=', q('page')),
        A('HolyHoly::Shuffle', q('Run.order'), '3'),
      ], [
        ev([C('HolyHoly::IsChapterDone', 'Run.chapter')], [setB('Run.firstTime', false)]),
        ev([isS('Run.hero', '=', q('jehudiel'))], [set('Run.manna', '*', '1.25')]),
        ev([isB('Run.firstTime', true)], [set('Run.manna', '+', '30'), set('Save.chaptersDone', '+', '1'), setS('Run.unlocked', '=', `${CH}.unlocks`)]),
        ev([], [
          set('Run.manna', '=', 'round(Run.manna)'),
          set('Save.light', '+', 'round(Run.light)'),
          set('Save.manna', '+', 'Run.manna'),
          setB(`Save.done[${CH}.id]`, true),
          setB(`Save.tools[${CH}.tool.id]`, true),
          set('Save.bestCombo', '=', 'max(Save.bestCombo, Run.bestCombo)'),
          set('Save.selected', '=', `min(Run.chapter + 1, VariableChildCount(Content.chapters) - 1)`),
          setS('Run.newRank', '=', 'HolyHoly::RankName(Save.light)'),
          store(),
          A('Psalm150::SetMood', `${CH}.track`, q('victory'), '0.5'),
          A('SetCameraCenterX', '=', '300', '""'),
          A('SetCameraCenterY', '=', '760', '""'),
          A('Scene3D::SetCameraZ', '=', '330', '""'),
          A('Scene3D::SetCameraRotationX', '=', String(90 - ELEVATION), '""'),
          A('CreateByName', 'Heroes', '"Hero_" + Run.hero', '-130', '0', '""'),
          A('CreateByName', 'People', '"Person_" + Save.profile.gender', '90', '40', '""'),
          set('Page', '=', '1'), set('T', '=', '0'),
          sfx('revelation'),
        ], applyQuality()),
      ]),
      ev([], [set('T', '+', dt)]),
    ]),
    group('Pages', [
      comment('Page 1: the thought record and three answers (shuffled: Run.order). Page 2: the truth. Page 3: the tool. Page 4: the report. Page 5: the finale, once, after the last chapter.'),
      ev([isB('Build', true)], [setB('Build', false)], [
        ...closePanel('page'),
        ev([is('Page', '=', '1')], cbtPage, [
          repeat('3', [], [
            set('o', '=', 'Run.order[c]'),
            set('y', '=', '284 + c * 128'),
            A('HolyHoly::MakePanel', 'UiCard', X0, 'y', TW, '120', q('card'), q('page'), q('UI')),
          ], [
            comment('Not chosen yet: the answer and a button. Chosen: what kind of answer it is and why, in its place.'),
            ev([cmp('Picked[c]', '=', '0')], [
              label('UiText', `${X0} + 18`, 'y + 12', `${TW} - 230`, '', { panel: 'page', key: 'opt', expr: G(`${CBT}.options[o].text`) }),
              button(`${X0} + ${TW} - 196`, 'y + 34', '180', '52', 'Odpowiem tak', 'cbt', { arg: 'c', panel: 'page' }),
            ]),
            ev([cmp('Picked[c]', '=', '1')], [
              label('UiSmall', `${X0} + 18`, 'y + 10', `${TW} - 36`, '', { panel: 'page', key: 'kind' }),
              label('UiSmall', `${X0} + 18`, 'y + 38', `${TW} - 36`, '', { panel: 'page', key: 'why', expr: G(`${CBT}.options[o].why`) }),
            ], [
              ev([oisS('UiSmall', 'Key', '=', q('kind')), ois('UiSmall', 'Index', '=', '0'), isS(`${CBT}.options[o].kind`, '=', q('balanced'))], [text('UiSmall', q('Zrównoważona ✓: prawdziwa i pomocna')), A('TextObject::ChangeColor', 'UiSmall', q('150;235;160'))]),
              ev([oisS('UiSmall', 'Key', '=', q('kind')), ois('UiSmall', 'Index', '=', '0'), isS(`${CBT}.options[o].kind`, '=', q('distorted'))], [text('UiSmall', q('Zniekształcona')), A('TextObject::ChangeColor', 'UiSmall', q('255;150;140'))]),
              ev([oisS('UiSmall', 'Key', '=', q('kind')), ois('UiSmall', 'Index', '=', '0'), isS(`${CBT}.options[o].kind`, '=', q('sugar'))], [text('UiSmall', q('Lukrowana: brzmi pięknie, ale nie wytrzyma zderzenia z życiem')), A('TextObject::ChangeColor', 'UiSmall', q('255;170;220'))]),
              ev([oisS('UiSmall', 'Key', '=', q('kind'))], [oset('UiSmall', 'Index', '=', '1')]),
            ]),
          ], { index: 'c', vars: { c: 0, o: 0, y: 0 } }),
          ev([isB(`${CBT}.helplines`, true)], [label('UiSmall', X0, 'SceneWindowHeight() - 52', TW, '', { panel: 'page', key: 'help', expr: '"Jeśli ta myśl jest ci bliska, nie zostawaj z nią sam: " + Content.story.helplinesShort + " (całą dobę)"' })]),
        ]),
        ev([is('Page', '=', '2')], truthPage),
        ev([is('Page', '=', '3')], toolPage, [
          ev([isB(`${CH}.tool.breathing`, true)], [button(X0, 'SceneWindowHeight() - 100', '240', '56', 'Ćwicz teraz', 'breathe', { panel: 'page' })]),
        ]),
        ev([is('Page', '=', '4')], reportPage),
        ev([is('Page', '=', '5')], finalePage),
        ev([oisS('UiAll', 'Panel', '=', q('page')), cmp('Page', '!=', '1')], [opacity('UiAll', '0'), oset('UiAll', 'Index', '=', '0')]),
        ev([oisS('UiPanel', 'Panel', '=', q('page'))], [opacity('UiPanel', '250'), oset('UiPanel', 'Index', '=', '1')]),
        ev([is('Page', '=', '2')], [
          A('Create', 'UiBar', X0, '0', q('UI')), osetS('UiBar', 'Key', '=', q('strike')), osetS('UiBar', 'Panel', '=', q('page')),
          size('UiBar', '2', '5'), tint('UiBar', q('255;80;70')), A('SetZOrder', 'UiBar', '=', '300'), opacity('UiBar', '0'),
        ]),
      ]),
      ev([begins()], [setB('Build', true), A('ClearVariableChildren', 'Picked')], [ev([], [A('PushNumber', 'Picked', '0'), A('PushNumber', 'Picked', '0'), A('PushNumber', 'Picked', '0')])]),
      ev([is('Page', '=', '1'), clicked('cbt')], [set('Picked[Ui.arg]', '=', '1'), setB('Build', true), set('o', '=', 'Run.order[Ui.arg]')], [
        ev([isS(`${CBT}.options[o].kind`, '=', q('balanced'))], [sfx('revelation', '2'), set('Wait', '=', '2.2')]),
        ev([NOT(isS(`${CBT}.options[o].kind`, '=', q('balanced')))], [sfx('weaken')]),
      ], { vars: { o: 0 } }),
      ev([cmp('Wait', '>', '0')], [set('Wait', '-', dt)], [ev([cmp('Wait', '<=', '0')], [set('Page', '=', '2'), set('T', '=', '0'), setB('Build', true)])]),
      comment('Page 2: the lie is crossed out, then the truth appears.'),
      ev([is('Page', '=', '2')], [], [
        reveal('ta', '0.1'), reveal('t1', '0.4'), reveal('t2', '2'), reveal('t3', '3'), reveal('t4', '3.6'), reveal('', '3.8'),
        ev([oisS('UiBar', 'Key', '=', q('strike')), cmp('T', '>=', '1.2'), ois('UiBar', 'Index', '=', '0')], [], [
          ev([oisS('UiText', 'Key', '=', q('t1'))], [
            oset('UiBar', 'Index', '=', '1'), opacity('UiBar', '255'),
            A('SetXY', 'UiBar', '=', 'UiText.X()', '=', 'UiText.Y() + 17'),
            tweenWidth('UiBar', 'strike', 'min(UiText.Width(), StrLength(UiText.Text::Value()) * 11.5)', '0.6'),
            sfx('weaken'),
          ]),
        ]),
      ]),
      ev([is('Page', '>=', '3')], [], [
        ...['oa', 'o1', 'o2', 'steps', 'o3', 'o4', 'ra', 'r1', 'r2', 'r3', 'r4', 'fa', 'f1', 'f2', 'f3'].map((k, i) => reveal(k, String(0.1 + (i % 6) * 0.35))),
        reveal('', '2.2'),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('steps'))], [text('UiSmall', '""')], [
        forEachChild(`${CH}.tool.steps`, 'stepText', 'n', [], [], [
          ev([], [text('UiSmall', `UiSmall.Text::Value() + ToString(ToNumber(n) + 1) + ". " + ${G('stepText')} + NewLine()`)]),
        ], { vars: { stepText: '', n: '' } }),
      ]),
      ev([oisS('UiText', 'Key', '=', q('r3')), cmpS('Run.newRank', '!=', 'Run.oldRank')], [text('UiText', '"Nowa ranga: " + Run.newRank + "!"')]),
      ev([oisS('UiText', 'Key', '=', q('r3')), cmpS('Run.newRank', '=', 'Run.oldRank')], [text('UiText', '"Ranga: " + Run.newRank')]),
      ev([oisS('UiText', 'Key', '=', q('r4')), isS('Run.unlocked', '!=', '""')], [text('UiText', '"Dołącza archanioł " + Content.heroes[Content.heroIndex[Run.unlocked]].name + ": „" + Content.heroes[Content.heroIndex[Run.unlocked]].meaning + "”"'), A('TextObject::ChangeColor', 'UiText', q('255;214;120'))]),
      ev([oisS('UiText', 'Key', '=', q('r4')), isS('Run.unlocked', '=', '""'), isB('Run.trial', true)], [text('UiText', '"Próba z archaniołem " + Content.heroes[Content.heroIndex[Run.hero]].name + " zakończona."')]),
      ev([is('Page', '=', '4'), cmp('T', '>=', '1.2'), C('BuiltinCommonInstructions::Once'), isS('Run.unlocked', '!=', '""')], [
        sfx('rank'),
        A('Create', 'UiArt', `${X0} + ${TW} - 90`, '420', q('UI')), animE('UiArt', 'Run.unlocked + "-icon"'), size('UiArt', '130', '130'), osetS('UiArt', 'Panel', '=', q('page')), A('SetZOrder', 'UiArt', '=', '300'),
      ]),
      comment('Buttons and keys: a click or a key first shows everything at once, then moves on.'),
      ev([is('Page', '>=', '2'), isS('Ui.top', '=', q('page')), OR(keyJust('Return'), keyJust('Space'))], [setS('Ui.clicked', '=', q('skip'))]),
      ev([clicked('skip'), cmp('T', '<', '5')], [set('T', '=', '5')]),
      ev([clicked('skip'), cmp('T', '>=', '5')], [], [
        ev([is('Page', '<=', '3')], [setS('Ui.clicked', '=', q('next'))]),
        ev([is('Page', '>=', '4')], [setS('Ui.clicked', '=', q('done'))]),
      ]),
      ev([clicked('next'), is('Page', '>=', '2'), is('Page', '<=', '3')], [set('Page', '+', '1'), set('T', '=', '0'), setB('Build', true)]),
      ev([clicked('done'), is('Page', '=', '4'), isS(`${CH}.id`, '=', q('anastasis')), isB('Save.settings.seenFinale', false)], [
        set('Page', '=', '5'), set('T', '=', '0'), setB('Build', true), setB('Save.settings.seenFinale', true), store(), setS('Ui.clicked', '=', '""'),
      ]),
      ev([clicked('done')], [scene('Ladder')]),
      ev([clicked('coffee')], [A('LaunchFile', 'Content.story.support.url')]),
      ev([clicked('breathe')], [], [...closePanel('page'), ev([], breathingPanel('breath'))]),
      breathingEvents('breath', 'page'),
      ev([isS('Ui.top', '=', q('page')), cmp('Page', '=', '3'), C('SceneInstancesCount', 'UiPanel', '=', '0')], [setB('Build', true), set('T', '=', '5')]),
    ]),
  ];
  return {
    name: 'Revelation',
    background: [26, 22, 18],
    layers: lightingLayers({ fog: '26;22;18', near: 1000, far: 3000, sky: '255;248;225', ground: '120;100;70', sun: 0.9, hemi: 0.7 }),
    objects,
    instances,
    events,
    variables: [v.num('Page', 1), v.num('T'), v.bool('Build'), v.array('Picked', [{ type: 'number', value: 0 }]), v.num('Wait'), v.bool('Breathing'), v.num('BreathT')],
    groups: [['Heroes', HERO_IDS.map(id => `Hero_${id}`)], ['People', ['Person_m', 'Person_f']]],
  };
}
