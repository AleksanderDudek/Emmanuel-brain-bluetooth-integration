// Story: the scenes of the person's life, told over painted panels (a visual novel). Run.story
// says which (the prologue, a chapter's intro or its healing) and Run.next where to go after it.
// Christ speaks only His own words from the Gospel, with the reference; He comes, the person
// answers. Before a heavy chapter a content note offers to skip it without losing anything.
import { A, C, NOT, OR, AND, ev, group, comment, q, set, setS, setB, is, isS, isB, cmp, cmpS, oisS, ois, oset, osetS, text, keyJust, link, begins, scene, animE, size, opacity, tint, tweenOpacity, dt } from './dsl.mjs';
import { layer, v } from './objects.mjs';
import { button, label, box, closePanel, sfx, clicked, SAVE_KEY } from './ui.mjs';
import { bootEvents } from './scene-title.mjs';

const CH = 'Content.chapters[Run.chapter]';
const LINE = 'Run.lines[Line]';
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));
const W = 'SceneWindowWidth()', H = 'SceneWindowHeight()';
const PANEL_ASPECT = 960 / 657;

export function storyScene() {
  const textBox = [
    box('40', `${H} - 236`, `${W} - 80`, '216', { key: 'textBox' }),
    label('UiSmall', '84', `${H} - 222`, 600, '', { key: 'speaker' }),
    label('UiText', '84', `${H} - 188`, `${W} - 380`, '', { key: 'line' }),
    label('UiSmall', '300', `${H} - 54`, `${W} - 640`, '', { key: 'ref' }),
    button(`${W} - 270`, `${H} - 118`, '200', '56', 'Dalej ▶', 'next'),
    button(`${W} - 270`, `${H} - 186`, '200', '48', 'Pomiń', 'skip'),
  ];
  const events = [
    link('UI'),
    bootEvents(),
    group('Start', [
      comment('A chapter\'s intro starts with its content note (if it has one); every scene then loads its lines with the person\'s forms resolved (HolyHoly::LoadScene).'),
      ev([begins()], [
        setS('Ui.top', '=', '""'), set('Line', '=', '-1'), setS('Shown', '=', '""'),
        A('Psalm150::SetMood', q('menu'), q('chapel'), '0.18'),
      ], [
        ev([isS('Run.story', '!=', q('prologue'))], [A('Psalm150::SetMood', `${CH}.track`, q('chapel'), '0.2')]),
        ev([isS('Run.story', '=', q('intro')), cmpS(`HolyHoly::G(${CH}.warning)`, '!=', '""')], [setS('State', '=', q('note'))]),
        ev([isS('State', '!=', q('note'))], [setS('State', '=', q('read')), setB('Advance', true)]),
        ev([], [A('HolyHoly::LoadScene', 'Run.story')]),
        ev([], textBox),
      ]),
    ]),
    group('Content note', [
      comment('Before heavy chapters: what is coming, help lines where it matters, and a way to skip the chapter without losing progress.'),
      ev([isS('State', '=', q('note')), C('BuiltinCommonInstructions::Once')], [
        setS('Ui.top', '=', q('note')),
        box(`(${W} - 820) / 2`, '90', '820', '520', { panel: 'note' }),
        label('UiTitle', `(${W} - 820) / 2`, '110', 820, 'Zanim wejdziesz', { panel: 'note', align: 'center' }),
        label('UiText', `(${W} - 720) / 2`, '180', 720, '', { panel: 'note', align: 'center', expr: `HolyHoly::G(${CH}.warning)` }),
        label('UiSmall', `(${W} - 720) / 2`, '360', 720, '', { panel: 'note', align: 'center', expr: '"Pomoc całą dobę: " + Content.story.helplinesShort + NewLine() + "To gra, nie terapia. Możesz w każdej chwili przerwać."' }),
        button(`(${W} - 560) / 2`, '520', '270', '58', 'Wchodzę', 'noteGo', { panel: 'note' }),
        button(`(${W} + 20) / 2`, '520', '270', '58', 'Pomiń rozdział', 'noteSkip', { panel: 'note' }),
      ]),
      ev([clicked('noteGo')], [setS('State', '=', q('read')), setS('Ui.top', '=', '""'), setB('Advance', true)], closePanel('note')),
      ev([clicked('noteSkip')], [
        setB(`Save.done[${CH}.id]`, true), setB('Run.skipped', true),
        set('Save.selected', '=', `min(Run.chapter + 1, VariableChildCount(Content.chapters) - 1)`),
        store(), scene('Ladder'),
      ]),
    ]),
    group('Reading', [
      comment('Space, Enter, a click or "Dalej" moves on; "Pomiń" ends the scene. The panel changes only when the line names a new one, with a short fade.'),
      ev([isS('State', '=', q('read')), isS('Ui.top', '=', '""'), OR(keyJust('Space'), keyJust('Return'), AND(C('MouseButtonFromTextReleased', q('Left')), NOT(C('IsCursorOnObject', 'UiButton'))))], [setS('Ui.clicked', '=', q('next'))]),
      ev([isS('State', '=', q('read')), clicked('next')], [setB('Advance', true), sfx('click')]),
      ev([isS('State', '=', q('read')), OR(clicked('skip'), keyJust('Escape'))], [set('Line', '=', 'VariableChildCount(Run.lines)'), setB('Advance', false), setS('State', '=', q('end'))]),
      ev([isB('Advance', true)], [setB('Advance', false), set('Line', '+', '1'), set('T', '=', '0')], [
        ev([cmp('Line', '>=', 'VariableChildCount(Run.lines)')], [setS('State', '=', q('end'))]),
        ev([cmp('Line', '<', 'VariableChildCount(Run.lines)')], [setB('Show', true)]),
      ]),
      ev([isB('Show', true)], [setB('Show', false)], [
        comment('A new painting: the old one fades out, the new one fades in, covering the screen above the text.'),
        ev([cmpS(`${LINE}.panel`, '!=', 'Shown')], [setS('Shown', '=', `${LINE}.panel`)], [
          ev([oisS('UiArt', 'Key', '=', q('panel'))], [osetS('UiArt', 'Key', '=', q('old')), tweenOpacity('UiArt', 'out', '0', '0.5', 'easeInQuad', true)]),
          ev([], [
            A('Create', 'UiArt', `${W} / 2`, `(${H} - 236) / 2`, q('UI')), animE('UiArt', `${LINE}.panel`), osetS('UiArt', 'Key', '=', q('panel')),
            size('UiArt', `max(${W}, (${H} - 200) * ${PANEL_ASPECT.toFixed(4)})`, `max(${W}, (${H} - 200) * ${PANEL_ASPECT.toFixed(4)}) / ${PANEL_ASPECT.toFixed(4)}`),
            A('SetZOrder', 'UiArt', '=', '10'), opacity('UiArt', '0'), tweenOpacity('UiArt', 'in', '255', '0.7'),
          ]),
          comment('Veiled mode: where Christ is painted, only light is seen (for those whose tradition does not portray Him).'),
          ev([oisS('UiBar', 'Key', '=', q('veil'))], [A('Delete', 'UiBar')]),
          ev([isB('Save.settings.veiled', true), cmp(`StrFind(${LINE}.panel, "heal") + StrFind(${LINE}.panel, "christ") + StrFind(${LINE}.panel, "anastasis-m") + StrFind(${LINE}.panel, "anastasis-f")`, '>', '-4')], [
            A('Create', 'UiBar', '0', '0', q('UI')), osetS('UiBar', 'Key', '=', q('veil')), size('UiBar', W, `${H} - 236`), tint('UiBar', q('255;244;214')), opacity('UiBar', '236'), A('SetZOrder', 'UiBar', '=', '12'),
          ]),
          ev([cmpS(`${LINE}.panel`, '=', '""')], [A('Delete', 'UiArt')]),
        ]),
        ev([oisS('UiSmall', 'Key', '=', q('speaker'))], [text('UiSmall', '""'), A('TextObject::ChangeColor', 'UiSmall', q('255;226;150'))], [
          ev([isS(`${LINE}.who`, '=', q('person'))], [text('UiSmall', 'HolyHoly::G("{imie}")')]),
          ev([isS(`${LINE}.who`, '=', q('angel'))], [text('UiSmall', 'Content.heroes[Content.heroIndex[Save.hero]].name + ", twój anioł"')]),
          ev([isS(`${LINE}.who`, '=', q('christ'))], [text('UiSmall', q('Jezus')), A('TextObject::ChangeColor', 'UiSmall', q('255;200;120'))]),
          ev([isS(`${LINE}.who`, '=', q('scripture'))], [text('UiSmall', q('Pismo'))]),
        ]),
        ev([oisS('UiText', 'Key', '=', q('line'))], [text('UiText', `${LINE}.text`), A('TextObject::ChangeColor', 'UiText', q('244;236;216'))], [
          ev([isS(`${LINE}.quote`, '!=', '""'), isS(`${LINE}.text`, '!=', '""')], [text('UiText', `${LINE}.text + NewLine() + "„" + ${LINE}.quote + "”"`)]),
          ev([isS(`${LINE}.quote`, '!=', '""'), isS(`${LINE}.text`, '=', '""')], [text('UiText', `"„" + ${LINE}.quote + "”"`)]),
          ev([isS(`${LINE}.who`, '=', q('christ'))], [A('TextObject::ChangeColor', 'UiText', q('255;236;190'))]),
          ev([isS(`${LINE}.who`, '=', q('angel'))], [A('TextObject::ChangeColor', 'UiText', q('255;214;120'))]),
        ]),
        ev([oisS('UiSmall', 'Key', '=', q('ref'))], [text('UiSmall', '""')], [
          ev([isS(`${LINE}.ref`, '!=', '""')], [text('UiSmall', `"(" + ${LINE}.ref + ", Biblia Gdańska)"`)]),
        ]),
        ev([oisS('UiText', 'Key', '=', q('line'))], [opacity('UiText', '0'), tweenOpacity('UiText', 'in', '255', '0.4')]),
      ]),
      ev([isS('State', '=', q('end'))], [setS('State', '=', q('gone'))], [
        ev([isS('Run.story', '=', q('prologue'))], [setB('Save.settings.seenPrologue', true), store()]),
        ev([], [A('Scene', 'Run.next', 'yes')]),
      ]),
    ]),
  ];
  return {
    name: 'Story',
    background: [10, 8, 12],
    layers: [layer('', { rendering: '2d' }), layer('UI', { rendering: '2d' })],
    objects: [],
    instances: [],
    events,
    variables: [v.str('State', 'read'), v.num('Line', -1), v.num('T'), v.str('Shown'), v.bool('Advance'), v.bool('Show')],
    groups: [],
  };
}
