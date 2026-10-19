// Shared UI: global variables, global objects, the UI external events and small builders.
import { A, C, NOT, OR, AND, ev, group, comment, q, set, setS, setB, is, isS, isB, cmp, oisS, ois, osetS, tint, text, key, keyJust, link } from './dsl.mjs';
import { v, text as textObj, panel, sprite, FONT_TITLE, FONT_TEXT } from './objects.mjs';
import { paintings } from './art.mjs';
import { HEROES, SKILLS } from '../tools/game-data.mjs';
import { CHAPTERS } from '../tools/story.mjs';

export const FRUITS = ['milosc', 'radosc', 'pokoj', 'cierpliwosc', 'uprzejmosc', 'dobroc', 'wiernosc', 'lagodnosc', 'opanowanie'];
export const SKILL_IDS = SKILLS.map(s => s.id);
export const HERO_IDS = HEROES.map(h => h.id);
export const CHAPTER_IDS = CHAPTERS.map(c => c.id);
// v2: the archangels' story (the chapters and the save of v1 do not carry over)
export const SAVE_KEY = 'holyholyholy3d.save.v2';

/** Balance in one place (seconds, GDevelop units, multipliers). */
export const TUNING = {
  arenaRadius: 1500, playerSpeed: 330, baseHearts: 5, grace: 1.1, stillDelay: 0.18,
  shotDamage: 12, shotCooldown: 0.42, shotRange: 620, shotSpeed: 1000,
  punchDamage: 30, punchReach: 190, punchCooldown: 0.16, missCooldown: 0.45, comboWindow: 1.1,
  prayerSeconds: 45, prayerPerKill: 1.6, prayerPerStrike: 0.6,
  magnet: 210, shardSpeed: 900,
  waveSeconds: 55, waves: 3, spawnInterval: 1.45, spawnMin: 0.4, maxAlive: 60,
  traumaSpeed: 70, traumaHpScale: 1.0, chapterHp: 0.2, waveHp: 0.15, eliteHp: 4, eliteValue: 6,
  xpFirst: 6, xpGrowth: 1.3, xpAdd: 3,
  bossHpScale: 6, bossArrowSpeed: 300, praiseSeconds: 7, affirmGap: 0.45,
};

export function globalVariables() {
  return [
    v.struct('Content', []),
    v.struct('Save', [
      v.num('version', 2), v.num('light'), v.num('manna'), v.num('bestCombo'), v.num('falls'), v.num('rises'), v.num('chaptersDone'), v.num('selected'),
      v.str('hero', 'uriel'), v.num('reframes'),
      v.struct('profile', [v.str('gender', 'm'), v.str('name'), v.bool('set')]),
      v.struct('done', []),
      v.struct('trials', HERO_IDS.map(h => v.bool(h))),
      v.struct('tools', []),
      v.struct('seen', []),
      v.struct('fruits', FRUITS.map(f => v.num(f))),
      v.struct('settings', [
        v.num('master', 0.7), v.num('music', 0.4), v.num('sfx', 0.7), v.bool('effects', true), v.bool('shake', true),
        v.bool('gentle'), v.bool('veiled'), v.bool('seenDisclaimer'), v.bool('seenHowTo'), v.bool('seenFinale'), v.bool('seenPrologue'),
      ]),
    ]),
    v.struct('Run', [
      v.num('chapter'), v.num('light'), v.num('destroyed'), v.num('bestCombo'), v.num('falls'), v.num('focusHeld'), v.num('level', 1), v.num('time'), v.num('manna'),
      v.str('oldRank'), v.str('newRank'), v.bool('firstTime'), v.str('hero', 'uriel'), v.bool('trial'), v.num('reframes'), v.num('discRight'), v.str('unlocked'),
      v.str('story'), v.str('next'), v.bool('skipped'),
      v.struct('gifts', SKILL_IDS.map(id => v.num(id))),
      v.struct('evo', SKILL_IDS.map(id => v.bool(id))),
      v.array('weapons'), v.array('virtues'), v.array('order'),
      v.array('choices', [{ type: 'structure', children: [v.str('id'), v.bool('evolve')] }]),
      v.array('lines', [{ type: 'structure', children: [v.str('who'), v.str('text'), v.str('quote'), v.str('ref'), v.str('panel')] }]),
      v.struct('disc', [v.str('kind'), v.str('name'), v.str('thought'), v.str('answer'), v.str('answerName'), v.str('question'), v.array('options'), v.array('names')]),
    ]),
    v.struct('Tuning', Object.entries(TUNING).map(([k, val]) => v.num(k, val))),
    v.struct('Ui', [v.str('clicked'), v.num('arg'), v.str('top'), v.num('lastWidth'), v.bool('touch')]),
  ];
}

export function globalObjects() {
  return [
    panel('UiPanel', 'assets/ui/panel.png', 30),
    panel('UiButton', 'assets/ui/button.png', 34),
    panel('UiCard', 'assets/ui/card.png', 30),
    panel('UiBar', 'assets/ui/bar.png', 5),
    textObj('UiText', { size: 26 }),
    textObj('UiSmall', { size: 20, color: '214;204;190' }),
    textObj('UiTitle', { font: FONT_TITLE, size: 44, color: '240;204;110', outline: true, outlineColor: '40;26;10' }),
    textObj('UiLabel', { font: FONT_TITLE, size: 22, color: '40;26;12', shadow: false }),
    textObj('UiBig', { font: FONT_TITLE, size: 64, color: '255;232;160', outline: true, outlineColor: '40;20;6' }),
    // every painting (archangels, their portraits, gifts, story panels, Christ…), one animation each
    sprite('UiArt', paintings().map(p => [p.name, p.file, p.w, p.h])),
    sprite('UiIcon', [
      ['heart', 'assets/ui/heart.png', 96], ['heartEmpty', 'assets/ui/heart-empty.png', 96], ['flame', 'assets/ui/flame.png', 96],
      ['flameEmpty', 'assets/ui/flame-empty.png', 96], ['light', 'assets/ui/light.png', 64], ['manna', 'assets/ui/manna.png', 64],
      ['rotate', 'assets/ui/rotate-device.png', 256], ['breath', 'assets/ui/breath.png', 256],
    ]),
  ];
}

export const UI_ALL = ['UiPanel', 'UiButton', 'UiCard', 'UiBar', 'UiText', 'UiSmall', 'UiTitle', 'UiLabel', 'UiBig', 'UiIcon', 'UiArt'];

// ─── builders used by scenes ───────────────────────────────────────────────────────────────────

export const button = (x, y, w, h, caption, action, { arg = 0, panel: p = '', layer = 'UI', captionExpr } = {}) =>
  A('HolyHoly::MakeButton', 'UiButton', 'UiLabel', x, y, w, h, captionExpr ?? q(caption), q(action), arg, q(p), q(layer));
export const label = (obj, x, y, w, content, { align = 'left', key: k = '', panel: p = '', layer = 'UI', expr } = {}) =>
  A('HolyHoly::MakeText', obj, x, y, w, expr ?? q(content), q(align), q(k), q(p), q(layer));
export const box = (x, y, w, h, { key: k = '', panel: p = '', layer = 'UI', obj = 'UiPanel' } = {}) =>
  A('HolyHoly::MakePanel', obj, x, y, w, h, q(k), q(p), q(layer));

/** Deletes every UI object of a panel. */
export const closePanel = name => [
  ...UI_ALL.map(o => ev([oisS(o, 'Panel', '=', q(name))], [A('Delete', o)])),
];

export const sfx = (name, step = '0', pan = '0') => A('Psalm150::PlaySfx', q(name), step, pan);
export const clicked = action => isS('Ui.clicked', '=', q(action));

/** Common UI events, linked at the top of every scene: buttons, hover, Escape. */
export function uiExternalEvents() {
  return [
    comment('Shared UI of every scene. Buttons are UiButton panels with a UiLabel caption, made with HolyHoly::MakeButton. A click on a button of the top panel (Ui.top) sets Ui.clicked to its Action for this frame; the scene reacts to it below the link.'),
    ev([], [setS('Ui.clicked', '=', '""')]),
    group('Buttons', [
      ev([C('IsCursorOnObject', 'UiButton'), C('Visible', 'UiButton'), C('BuiltinCommonInstructions::CompareStrings', 'UiButton.Panel', '=', 'Ui.top')], [tint('UiButton', q('255;250;235'))]),
      ev([NOT(C('IsCursorOnObject', 'UiButton')), C('Visible', 'UiButton')], [tint('UiButton', q('236;222;196'))]),
      ev([C('MouseButtonFromTextReleased', q('Left')), C('IsCursorOnObject', 'UiButton'), C('Visible', 'UiButton'), C('BuiltinCommonInstructions::CompareStrings', 'UiButton.Panel', '=', 'Ui.top'), oisS('UiButton', 'Action', '!=', '""')],
        [setS('Ui.clicked', '=', 'UiButton.Action'), set('Ui.arg', '=', 'UiButton.Arg'), sfx('click')]),
      ev([keyJust('Escape'), isS('Ui.top', '!=', '""')], [setS('Ui.clicked', '=', q('close'))]),
    ], { folded: false }),
    group('Touch', [
      ev([C('HasAnyTouchOrMouseStarted'), C('HolyHoly::IsTouchDevice')], [setB('Ui.touch', true)]),
    ]),
    group('Turn the phone', [
      comment('The game is landscape: on a portrait screen a hint asks to turn the phone.'),
      ev([cmp('SceneWindowHeight()', '>', 'SceneWindowWidth()'), C('BuiltinCommonInstructions::Once')], [
        A('HolyHoly::MakePanel', 'UiPanel', '0', '0', 'SceneWindowWidth()', 'SceneWindowHeight()', q('rotate'), q('rotate'), q('UI')),
        A('Create', 'UiIcon', 'SceneWindowWidth() / 2', 'SceneWindowHeight() / 2 - 60', q('UI')),
        A('AnimatableCapability::AnimatableBehavior::SetName', 'UiIcon', 'Animation', '=', q('rotate')),
        osetS('UiIcon', 'Panel', '=', q('rotate')),
        A('SetZOrder', 'UiIcon', '=', '1000'),
        A('HolyHoly::MakeText', 'UiText', '40', 'SceneWindowHeight() / 2 + 90', 'SceneWindowWidth() - 80', q('Obróć telefon poziomo'), q('center'), q('rotate'), q('rotate'), q('UI')),
      ]),
      ev([cmp('SceneWindowHeight()', '<=', 'SceneWindowWidth()')], [], closePanel('rotate')),
      ev([oisS('UiPanel', 'Key', '=', q('rotate'))], [A('SetZOrder', 'UiPanel', '=', '999')]),
      ev([oisS('UiText', 'Key', '=', q('rotate'))], [A('SetZOrder', 'UiText', '=', '1001')]),
    ]),
  ];
}

/** Settings panel (Title and pause): volumes, graphics, screen shake, gentle mode, how Christ is shown. */
export function settingsPanel(panelName = 'settings', layer = 'UI') {
  const W = 680, H = 620;
  const x0 = `(SceneWindowWidth() - ${W}) / 2`, y0 = `max(10, (SceneWindowHeight() - ${H}) / 2)`;
  const row = (i, labelKey, minus, plus) => [
    label('UiText', `${x0} + 40`, `${y0} + 100 + ${i * 58}`, 330, '', { key: labelKey, panel: panelName, layer }),
    button(`${x0} + ${W - 200}`, `${y0} + 92 + ${i * 58}`, 70, 46, '−', minus, { panel: panelName, layer }),
    button(`${x0} + ${W - 115}`, `${y0} + 92 + ${i * 58}`, 70, 46, '+', plus, { panel: panelName, layer }),
  ];
  const toggle = (i, labelKey, action) => [
    label('UiText', `${x0} + 40`, `${y0} + 100 + ${i * 58}`, 440, '', { key: labelKey, panel: panelName, layer }),
    button(`${x0} + ${W - 200}`, `${y0} + 92 + ${i * 58}`, 155, 46, 'Zmień', action, { panel: panelName, layer }),
  ];
  return [
    box(x0, y0, W, H, { panel: panelName, layer }),
    label('UiTitle', x0, `${y0} + 26`, W, 'Ustawienia', { align: 'center', panel: panelName, layer }),
    ...row(0, 'setMaster', 'master-', 'master+'),
    ...row(1, 'setMusic', 'music-', 'music+'),
    ...row(2, 'setSfx', 'sfx-', 'sfx+'),
    ...toggle(3, 'setEffects', 'effects'),
    ...toggle(4, 'setShake', 'shake'),
    ...toggle(5, 'setGentle', 'gentle'),
    ...toggle(6, 'setVeiled', 'veiled'),
    button(`${x0} + ${W / 2 - 110}`, `${y0} + ${H - 76}`, 220, 54, 'Gotowe', 'close', { panel: panelName, layer }),
  ];
}

/** Settings: react to clicks and keep the labels current. */
export function settingsEvents() {
  const step = (name, delta) => ev([isS('Ui.clicked', '=', q(name))], [set(`Save.settings.${name.slice(0, -1)}`, '=', `clamp(round((Save.settings.${name.slice(0, -1)} ${delta}) * 10) / 10, 0, 1)`), A('Psalm150::SetVolumes', 'Save.settings.master', 'Save.settings.music', 'Save.settings.sfx'), A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY))]);
  const flip = (action, setting) => ev([isS('Ui.clicked', '=', q(action))], [A('SetBooleanVariable', `Save.settings.${setting}`, 'Toggle'), A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY))]);
  const pct = name => `ToString(round(Save.settings.${name} * 100)) + "%"`;
  const says = (k, setting, yes, no) => [
    ev([oisS('UiText', 'Key', '=', q(k)), isB(`Save.settings.${setting}`, true)], [text('UiText', q(yes))]),
    ev([oisS('UiText', 'Key', '=', q(k)), isB(`Save.settings.${setting}`, false)], [text('UiText', q(no))]),
  ];
  return group('Settings', [
    step('master-', '- 0.1'), step('master+', '+ 0.1'), step('music-', '- 0.1'), step('music+', '+ 0.1'), step('sfx-', '- 0.1'), step('sfx+', '+ 0.1'),
    flip('effects', 'effects'), flip('shake', 'shake'), flip('gentle', 'gentle'), flip('veiled', 'veiled'),
    ev([oisS('UiText', 'Key', '=', q('setMaster'))], [text('UiText', `"Głośność: " + ${pct('master')}`)]),
    ev([oisS('UiText', 'Key', '=', q('setMusic'))], [text('UiText', `"Muzyka: " + ${pct('music')}`)]),
    ev([oisS('UiText', 'Key', '=', q('setSfx'))], [text('UiText', `"Efekty dźwiękowe: " + ${pct('sfx')}`)]),
    ...says('setEffects', 'effects', 'Grafika: pełna (poświata, cienie)', 'Grafika: lekka (dla telefonu)'),
    ...says('setShake', 'shake', 'Wstrząsy ekranu: tak', 'Wstrząsy ekranu: nie'),
    ...says('setGentle', 'gentle', 'Tryb łagodny: tak (słabsze cienie, więcej serc)', 'Tryb łagodny: nie'),
    ...says('setVeiled', 'veiled', 'Chrystus w scenach: tylko światło', 'Chrystus w scenach: ikona'),
  ]);
}

/** Guided breathing (the first chapter's tool): a circle that grows with the in-breath, a second short sip, a long out-breath. */
export function breathingPanel(panelName = 'breath') {
  const X = '(SceneWindowWidth() - 720) / 2';
  return [
    setB('Breathing', true), set('BreathT', '=', '0'), setS('Ui.top', '=', q(panelName)),
    box(X, '50', '720', '620', { panel: panelName }),
    label('UiTitle', X, '70', 720, 'Oddech z westchnieniem', { panel: panelName, align: 'center' }),
    A('Create', 'UiIcon', 'SceneWindowWidth() / 2', '330', q('UI')), A('AnimatableCapability::AnimatableBehavior::SetName', 'UiIcon', 'Animation', '=', q('breath')),
    osetS('UiIcon', 'Panel', '=', q(panelName)), osetS('UiIcon', 'Key', '=', q('breathCircle')), A('SetZOrder', 'UiIcon', '=', '300'),
    label('UiText', `${X} + 40`, '520', 640, '', { panel: panelName, align: 'center', key: 'breathCue' }),
    label('UiSmall', `${X} + 40`, '566', 640, '', { panel: panelName, align: 'center', key: 'breathCount' }),
    button('(SceneWindowWidth() - 220) / 2', '606', '220', '50', 'Zakończ', 'breathStop', { panel: panelName }),
  ];
}

export function breathingEvents(panelName = 'breath', back = 'tools') {
  const c = 'mod(BreathT, 13)';
  const cue = (cond, t) => ev([isB('Breathing', true), ...cond, C('BuiltinCommonInstructions::CompareNumbers', 'BreathT', '<', '78')], [], [ev([oisS('UiText', 'Key', '=', q('breathCue'))], [text('UiText', q(t))])]);
  return group('Guided breathing', [
    comment('Cyclic sighing: in through the nose (4 s), a short second sip (1 s), a long slow breath out (8 s); six rounds. Exhale-focused breathing has moderate evidence for lowering stress (Balban 2023).'),
    ev([isB('Breathing', true)], [set('BreathT', '+', 'TimeDelta()')]),
    ev([isB('Breathing', true), oisS('UiIcon', 'Key', '=', q('breathCircle')), cmp(c, '<', '4')], [A('ScalableCapability::ScalableBehavior::SetValue', 'UiIcon', 'Scale', '=', `0.55 + 0.55 * ${c} / 4`)]),
    ev([isB('Breathing', true), oisS('UiIcon', 'Key', '=', q('breathCircle')), cmp(c, '>=', '4'), cmp(c, '<', '5')], [A('ScalableCapability::ScalableBehavior::SetValue', 'UiIcon', 'Scale', '=', `1.1 + 0.14 * (${c} - 4)`)]),
    ev([isB('Breathing', true), oisS('UiIcon', 'Key', '=', q('breathCircle')), cmp(c, '>=', '5')], [A('ScalableCapability::ScalableBehavior::SetValue', 'UiIcon', 'Scale', '=', `1.24 - 0.69 * (${c} - 5) / 8`)]),
    cue([cmp(c, '<', '4')], 'Spokojny wdech nosem…'),
    cue([cmp(c, '>=', '4'), cmp(c, '<', '5')], '…i jeszcze trochę powietrza'),
    cue([cmp(c, '>=', '5')], 'Długi, powolny wydech ustami…'),
    ev([isB('Breathing', true), cmp('BreathT', '>=', '78')], [], [
      ev([oisS('UiText', 'Key', '=', q('breathCue'))], [text('UiText', q('Dobrze. Zauważ, jak teraz czuje się twoje ciało.'))]),
      ev([oisS('UiIcon', 'Key', '=', q('breathCircle'))], [A('ScalableCapability::ScalableBehavior::SetValue', 'UiIcon', 'Scale', '=', '0.8')]),
    ]),
    ev([isB('Breathing', true)], [], [ev([oisS('UiSmall', 'Key', '=', q('breathCount'))], [text('UiSmall', '"Oddech " + ToString(min(6, floor(BreathT / 13) + 1)) + " z 6 · możesz zamknąć oczy"')])]),
    ev([OR(isS('Ui.clicked', '=', q('breathStop')), AND(isS('Ui.clicked', '=', q('close')), isS('Ui.top', '=', q(panelName))))], [setB('Breathing', false), setS('Ui.top', '=', q(back)), setS('Ui.clicked', '=', '""')], closePanel(panelName)),
  ]);
}
