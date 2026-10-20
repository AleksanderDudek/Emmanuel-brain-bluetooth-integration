// The project's own extensions: HolyHoly (helpers), Psalm150 (music and effects), MendiFocus (band + focus).
import { js } from './dsl.mjs';

const param = (name, type, description, extra = {}) => ({ name, type, description, ...extra });

function fn(name, functionType, fullName, description, sentence, parameters, code, extra = {}) {
  return {
    name,
    fullName,
    description,
    sentence,
    functionType,
    group: extra.group ?? '',
    ...(extra.expressionType ? { expressionType: extra.expressionType } : {}),
    private: false,
    events: [js(code)],
    parameters,
    objectGroups: [],
  };
}

const action = (name, fullName, description, sentence, parameters, code, group) => fn(name, 'Action', fullName, description, sentence, parameters, code, { group });
const condition = (name, fullName, description, sentence, parameters, code, group) => fn(name, 'Condition', fullName, description, sentence, parameters, code, { group });
const expression = (name, fullName, description, parameters, code, group) => fn(name, 'Expression', fullName, description, '', parameters, code, { group, expressionType: { type: 'expression' } });
const stringExpression = (name, fullName, description, parameters, code, group) => fn(name, 'StringExpression', fullName, description, '', parameters, code, { group, expressionType: { type: 'string' } });

function extension(name, fullName, shortDescription, description, category, eventsFunctions, sourceFiles = []) {
  return {
    author: 'HolyHolyHoly',
    category,
    dimension: '',
    extensionNamespace: '',
    fullName,
    gdevelopVersion: '',
    helpPath: '',
    iconUrl: '',
    name,
    previewIconUrl: '',
    shortDescription,
    version: '1.0.0',
    description,
    tags: ['holyholyholy'],
    authorIds: [],
    dependencies: [],
    globalVariables: [],
    sceneVariables: [],
    eventsFunctions,
    eventsBasedBehaviors: [],
    eventsBasedObjects: [],
    ...(sourceFiles.length ? { sourceFiles } : {}),
  };
}

// ─── HolyHoly: helpers that events cannot express ───────────────────────────────────────────────

const arg = n => `eventsFunctionContext.getArgument(${JSON.stringify(n)})`;

/** Shared prelude of the story helpers: the person's gender and name, and the {a|b} / {imie} resolver. */
const GLOBALS = `
const game = runtimeScene.getGame();
const g = name => game.getVariables().get(name);
const female = g('Save').getChild('profile').getChild('gender').getAsString() === 'f';
const person = g('Save').getChild('profile').getChild('name').getAsString() || (female ? 'Ewa' : 'Adam');
/** {a|b}: the man's or the woman's form; {imie}: the person's name. */
const G = text => String(text).replace(/\\{imie\\}/g, person).replace(/\\{([^{}|]*)\\|([^{}]*)\\}/g, (_, m, f) => (female ? f : m));
const pick = list => list[Math.floor(Math.random() * list.length)];
`;

export const holyHoly = extension('HolyHoly', 'HolyHolyHoly helpers',
  'Content loading, saving, 3D-to-screen projection and device helpers for HolyHolyHoly 3D.',
  'Small JavaScript helpers used by the scenes: load the game content (JSON) into a global variable, keep the save in the browser storage (merged over the defaults, so new fields keep their default values), project a 3D position to a 2D layer, and read device preferences (touch screen, reduced motion).',
  'General',
  [
    action('LoadJsonIntoGlobal', 'Load a JSON resource into a global variable', 'Replaces the global variable with the content of a JSON resource (preloaded with the game).',
      'Load _PARAM1_ into global variable _PARAM2_',
      [param('Resource', 'jsonResource', 'JSON resource'), param('Variable', 'string', 'Name of the global variable')], `
const game = runtimeScene.getGame();
const target = game.getVariables().get(${arg('Variable')});
const resource = ${arg('Resource')};
const manager = game.getJsonManager();
const apply = content => { if (content) target.fromJSObject(content); };
if (manager.isJsonLoaded(resource)) apply(manager.getLoadedJson(resource));
else manager.loadJson(resource, (error, content) => { if (error) console.error('HolyHoly: cannot load', resource, error); else apply(content); });
`, 'Data'),
    condition('IsGlobalLoaded', 'Global variable has content', 'Checks that a global structure variable has children (e.g. the content finished loading).',
      'Global variable _PARAM1_ is loaded', [param('Variable', 'string', 'Name of the global variable')], `
const v = runtimeScene.getGame().getVariables().get(${arg('Variable')});
eventsFunctionContext.returnValue = v.getType() === 'structure' && Object.keys(v.getAllChildren()).length > 0;
`, 'Data'),
    action('LoadSave', 'Load the save', 'Reads the save from the browser storage and merges it over the global variable (its current value holds the defaults). Unknown or broken data is ignored.',
      'Load the save _PARAM2_ into global variable _PARAM1_', [param('Variable', 'string', 'Name of the global variable'), param('Key', 'string', 'Storage key')], `
const target = runtimeScene.getGame().getVariables().get(${arg('Variable')});
let saved = null;
try {
  saved = JSON.parse(window.localStorage.getItem(${arg('Key')}) || 'null');
} catch (e) {
  saved = null; // private mode or corrupted data: keep the defaults
}
const merge = (variable, data) => {
  for (const key of Object.keys(data)) {
    const value = data[key];
    const child = variable.getChild(key);
    if (value && typeof value === 'object' && !Array.isArray(value) && child.getType() === 'structure') merge(child, value);
    else child.fromJSObject(value);
  }
};
if (saved && typeof saved === 'object' && !Array.isArray(saved)) merge(target, saved);
`, 'Save'),
    action('StoreSave', 'Store the save', 'Writes the global variable to the browser storage (ignored when storage is unavailable).',
      'Store global variable _PARAM1_ as save _PARAM2_', [param('Variable', 'string', 'Name of the global variable'), param('Key', 'string', 'Storage key')], `
const source = runtimeScene.getGame().getVariables().get(${arg('Variable')});
try {
  window.localStorage.setItem(${arg('Key')}, JSON.stringify(source.toJSObject()));
} catch (e) {
  // storage full or blocked: the game goes on, progress stays in memory
}
`, 'Save'),
    expression('ScreenX', 'Screen X of a 3D position', 'X on the 2D layers of a position in the 3D world (base layer camera).',
      [param('X', 'expression', 'X'), param('Y', 'expression', 'Y'), param('Z', 'expression', 'Z (elevation)')], `
const camera = runtimeScene.getLayer('').getRenderer().getThreeCamera();
if (!camera || typeof THREE === 'undefined') { eventsFunctionContext.returnValue = 0; return; }
const v = new THREE.Vector3(${arg('X')}, -${arg('Y')}, ${arg('Z')});
camera.updateMatrixWorld();
v.project(camera);
eventsFunctionContext.returnValue = (v.x + 1) / 2 * runtimeScene.getGame().getGameResolutionWidth();
`, '3D'),
    expression('ScreenY', 'Screen Y of a 3D position', 'Y on the 2D layers of a position in the 3D world (base layer camera).',
      [param('X', 'expression', 'X'), param('Y', 'expression', 'Y'), param('Z', 'expression', 'Z (elevation)')], `
const camera = runtimeScene.getLayer('').getRenderer().getThreeCamera();
if (!camera || typeof THREE === 'undefined') { eventsFunctionContext.returnValue = 0; return; }
const v = new THREE.Vector3(${arg('X')}, -${arg('Y')}, ${arg('Z')});
camera.updateMatrixWorld();
v.project(camera);
eventsFunctionContext.returnValue = (1 - v.y) / 2 * runtimeScene.getGame().getGameResolutionHeight();
`, '3D'),
    condition('IsTouchDevice', 'Touch screen', 'The device has a touch screen.', 'The device has a touch screen', [], `
eventsFunctionContext.returnValue = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
`, 'Device'),
    condition('PrefersReducedMotion', 'Prefers reduced motion', 'The system asks for less motion (no screen shake).', 'The player prefers reduced motion', [], `
eventsFunctionContext.returnValue = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
`, 'Device'),
    action('Vibrate', 'Vibrate', 'A short vibration on phones that support it.', 'Vibrate for _PARAM1_ ms', [param('Milliseconds', 'expression', 'Duration (ms)')], `
try { if (navigator.vibrate) navigator.vibrate(Math.max(0, Math.min(400, ${arg('Milliseconds')}))); } catch (e) {}
`, 'Device'),
    stringExpression('Clock', 'Clock text', 'Seconds as m:ss.', [param('Seconds', 'expression', 'Seconds')], `
const s = Math.max(0, Math.ceil(${arg('Seconds')}));
eventsFunctionContext.returnValue = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
`, 'Text'),
    stringExpression('Decimal', 'Polish decimal', 'A number with a decimal comma (1,5).', [param('Value', 'expression', 'Value')], `
const v = Math.round(${arg('Value')} * 10) / 10;
eventsFunctionContext.returnValue = String(v).replace('.', ',');
`, 'Text'),
    expression('RankIndex', 'Rank index', 'Index of the angelic rank reached with this much light (Content.ranks).',
      [param('Light', 'expression', 'Lifetime light')], `
const ranks = runtimeScene.getGame().getVariables().get('Content').getChild('ranks').getAllChildrenArray();
const light = ${arg('Light')};
let index = 0;
ranks.forEach((r, i) => { if (light >= r.getChild('light').getAsNumber()) index = i; });
eventsFunctionContext.returnValue = index;
`, 'Progress'),
    expression('RankWings', 'Wings of the rank', 'Number of wings (2, 4 or 6) of the rank reached with this much light.',
      [param('Light', 'expression', 'Lifetime light')], `
const ranks = runtimeScene.getGame().getVariables().get('Content').getChild('ranks').getAllChildrenArray();
const light = ${arg('Light')};
let wings = 2;
ranks.forEach(r => { if (light >= r.getChild('light').getAsNumber()) wings = r.getChild('wings').getAsNumber(); });
eventsFunctionContext.returnValue = wings;
`, 'Progress'),
    stringExpression('RankName', 'Name of the rank', 'Name of the angelic rank reached with this much light.',
      [param('Light', 'expression', 'Lifetime light')], `
const ranks = runtimeScene.getGame().getVariables().get('Content').getChild('ranks').getAllChildrenArray();
const light = ${arg('Light')};
let name = '';
ranks.forEach(r => { if (light >= r.getChild('light').getAsNumber()) name = r.getChild('name').getAsString(); });
eventsFunctionContext.returnValue = name;
`, 'Progress'),
    expression('NextRankLight', 'Light of the next rank', 'Light needed for the next rank (0 at the last one).',
      [param('Light', 'expression', 'Lifetime light')], `
const ranks = runtimeScene.getGame().getVariables().get('Content').getChild('ranks').getAllChildrenArray();
const light = ${arg('Light')};
const next = ranks.map(r => r.getChild('light').getAsNumber()).find(l => l > light);
eventsFunctionContext.returnValue = next === undefined ? 0 : next;
`, 'Progress'),
    condition('IsChapterOpen', 'Chapter is open', 'The chapter can be played: the first one, or the chapter that opens it is done.',
      'Chapter _PARAM1_ is open', [param('Index', 'expression', 'Chapter index')], `
const game = runtimeScene.getGame();
const chapters = game.getVariables().get('Content').getChild('chapters');
const index = Math.round(${arg('Index')});
if (index < 0 || index >= chapters.getChildrenCount()) { eventsFunctionContext.returnValue = false; return; }
const by = chapters.getChildAt(index).getChild('unlockedBy').getAsString();
const done = game.getVariables().get('Save').getChild('done');
eventsFunctionContext.returnValue = by === '' || (done.hasChild(by) && done.getChild(by).getAsBoolean());
`, 'Progress'),
    condition('IsChapterDone', 'Chapter is done', 'The chapter has been completed at least once.',
      'Chapter _PARAM1_ is done', [param('Index', 'expression', 'Chapter index')], `
const game = runtimeScene.getGame();
const chapters = game.getVariables().get('Content').getChild('chapters');
const index = Math.round(${arg('Index')});
if (index < 0 || index >= chapters.getChildrenCount()) { eventsFunctionContext.returnValue = false; return; }
const id = chapters.getChildAt(index).getChild('id').getAsString();
const done = game.getVariables().get('Save').getChild('done');
eventsFunctionContext.returnValue = done.hasChild(id) && done.getChild(id).getAsBoolean();
`, 'Progress'),
    action('FitTexts', 'Fit the texts that changed', 'Every UI text made with a maximum height (HolyHoly::MakeText) whose content changed since it was last fitted is set back to its size and made smaller, a point at a time (down to 60 %), until it fits its room again.',
      'Fit the UI texts that changed', [], `
for (const name of ['UiText', 'UiSmall', 'UiTitle', 'UiLabel', 'UiBig']) {
  for (const t of runtimeScene.getObjects(name) || []) {
    const vars = t.getVariables();
    const maxH = vars.get('MaxH').getAsNumber();
    if (maxH <= 0 || vars.get('FitText').getAsString() === t.getText()) continue;
    vars.get('FitText').setString(t.getText());
    const base = vars.get('Size').getAsNumber() || t.getCharacterSize();
    const smallest = Math.max(10, Math.round(base * 0.6));
    let size = base;
    t.setCharacterSize(size);
    while (t.getHeight() > maxH && size > smallest) t.setCharacterSize(--size);
  }
}
`, 'UI'),
    action('ExposeForTests', 'Expose the game for automated tests', 'Publishes window.HolyHolyHoly3D = { game } so headless browser tests can read the state.',
      'Expose the game for automated tests', [], `
window.HolyHolyHoly3D = { game: runtimeScene.getGame() };
`, 'Debug'),
    ...storyFunctions(),
  ]);

// ─── HolyHoly: the person, the story and the gifts (JavaScript, data-heavy) ─────────────────────


function storyFunctions() {
  return [
    stringExpression('G', 'Text for the person', 'Resolves the {man|woman} forms and the {imie} name of a text, for the person under the angel\'s protection (Save.profile).',
      [param('Text', 'string', 'Text with {a|b} forms')], `${GLOBALS}
eventsFunctionContext.returnValue = G(${arg('Text')});`, 'Story'),
    action('LoadScene', 'Load a story scene', 'Copies the lines of a scene (prologue, a chapter\'s intro or heal) into the global Run.lines, with the person\'s forms and name resolved.',
      'Load story scene _PARAM1_', [param('Which', 'string', 'prologue, intro or heal')], `${GLOBALS}
const which = ${arg('Which')};
const content = g('Content');
const chapter = content.getChild('chapters').getChildAt(Math.max(0, g('Run').getChild('chapter').getAsNumber()));
const source = which === 'prologue' ? content.getChild('story').getChild('prologue') : chapter.getChild('story').getChild(which);
const lines = source.toJSObject() || [];
g('Run').getChild('lines').fromJSObject(lines.map(l => ({ who: l.who, text: G(l.text || ''), quote: G(l.quote || ''), ref: G(l.ref || ''), panel: G(l.panel || '') })));
`, 'Story'),
    action('DrawChoices', 'Draw gift choices', 'Fills Run.choices with up to N gifts or virtues the angel can take now: never more than four of each, the archangel\'s own gift only, and an evolution first when one is ready (a gift at its last level with its virtue owned).',
      'Draw _PARAM1_ gift choices', [param('Count', 'expression', 'How many')], `${GLOBALS}
const content = g('Content'), run = g('Run');
const skills = content.getChild('skills').toJSObject();
const order = content.getChild('skillOrder').toJSObject();
const levels = run.getChild('gifts').toJSObject() || {};
const evo = run.getChild('evo').toJSObject() || {};
const hero = run.getChild('hero').getAsString();
const weapons = (run.getChild('weapons').toJSObject() || []).length;
const virtues = (run.getChild('virtues').toJSObject() || []).length;
const evolutions = [], pool = [];
for (const id of order) {
  const s = skills[id];
  const level = levels[id] || 0;
  if (s.kind === 'signature' && s.hero !== hero) continue;
  if (level >= s.maxLevel) {
    if (s.evolution.with && !evo[id] && (levels[s.evolution.with] || 0) > 0) evolutions.push({ id, evolve: true });
    continue;
  }
  if (level === 0 && !s.consumable && (s.kind === 'virtue' ? virtues >= 4 : weapons >= 4)) continue;
  pool.push({ id, evolve: false });
}
const count = Math.max(0, Math.round(${arg('Count')}));
const choices = evolutions.slice(0, count);
while (choices.length < count && pool.length) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
run.getChild('choices').fromJSObject(choices);
`, 'Gifts'),
    action('TakeSkill', 'Take a gift', 'Raises a gift or virtue one level (or evolves it) and fills its slot the first time.',
      'Take gift _PARAM1_ (evolution: _PARAM2_)', [param('Id', 'string', 'Gift id'), param('Evolve', 'yesorno', 'Evolve it')], `${GLOBALS}
const run = g('Run');
const id = ${arg('Id')};
const skill = g('Content').getChild('skills').getChild(id).toJSObject();
if (!skill || !skill.kind) return;
if (${arg('Evolve')}) { run.getChild('evo').getChild(id).setBoolean(true); return; }
const level = run.getChild('gifts').getChild(id);
level.setNumber(level.getAsNumber() + 1);
if (level.getAsNumber() === 1 && !skill.consumable) {
  const slots = run.getChild(skill.kind === 'virtue' ? 'virtues' : 'weapons');
  slots.pushValue(id);
}
`, 'Gifts'),
    stringExpression('SkillIcon', 'Icon of a gift', 'The painting that shows a gift now: its first stage, its mature stage from level 3, or its evolution.',
      [param('Id', 'string', 'Gift id')], `${GLOBALS}
const id = ${arg('Id')};
const skill = g('Content').getChild('skills').getChild(id).toJSObject();
const icons = (skill && skill.icons) || [];
if (!icons.length) { eventsFunctionContext.returnValue = ''; return; }
const run = g('Run');
const evolved = run.getChild('evo').hasChild(id) && run.getChild('evo').getChild(id).getAsBoolean();
const level = run.getChild('gifts').hasChild(id) ? run.getChild('gifts').getChild(id).getAsNumber() : 0;
eventsFunctionContext.returnValue = icons[Math.min(icons.length - 1, evolved ? 2 : level >= 3 ? 1 : 0)];`, 'Gifts'),
    stringExpression('ChoiceIcon', 'Icon of a drawn card', 'The painting of the card at this index of Run.choices (its evolution, or the stage it reaches if taken).',
      [param('Index', 'expression', 'Index in Run.choices')], `${GLOBALS}
const run = g('Run');
const choice = (run.getChild('choices').toJSObject() || [])[Math.round(${arg('Index')})];
const skill = choice && g('Content').getChild('skills').getChild(choice.id).toJSObject();
const icons = (skill && skill.icons) || [];
const level = choice && run.getChild('gifts').hasChild(choice.id) ? run.getChild('gifts').getChild(choice.id).getAsNumber() : 0;
eventsFunctionContext.returnValue = icons.length ? icons[Math.min(icons.length - 1, choice.evolve ? 2 : level + 1 >= 3 ? 1 : 0)] : '';`, 'Gifts'),
    stringExpression('Reframe', 'What a broken shadow leaves', 'A realistic statement in the person\'s voice, for a shadow-thought of this kind.',
      [param('Kind', 'string', 'Shadow kind')], `${GLOBALS}
const e = g('Content').getChild('enemies').getChild(${arg('Kind')}).toJSObject();
eventsFunctionContext.returnValue = e && e.reframes ? G(pick(e.reframes)) : '';`, 'Story'),
    stringExpression('AngelWord', 'What the angel says', 'Words of worth for the person, from the angel, in the second person.',
      [param('Kind', 'string', 'Shadow kind')], `${GLOBALS}
const e = g('Content').getChild('enemies').getChild(${arg('Kind')}).toJSObject();
eventsFunctionContext.returnValue = e && e.angel ? G(pick(e.angel)) : '';`, 'Story'),
    stringExpression('Thought', 'What a shadow whispers', 'One of the thoughts of a shadow-thought.',
      [param('Kind', 'string', 'Shadow kind')], `${GLOBALS}
const e = g('Content').getChild('enemies').getChild(${arg('Kind')}).toJSObject();
eventsFunctionContext.returnValue = e && e.thoughts ? G(pick(e.thoughts)) : '';`, 'Story'),
    action('DrawVoice', 'Draw a voice', 'Fills Run.voice with a speaking shadow of this chapter (Content.chapters[].voices, by index, wrapping around): what it says, the thinking error it hides with its signal words and testing question, what negates it and the truth, all resolved for the person.',
      'Draw voice number _PARAM1_ of this chapter', [param('Index', 'expression', 'Voice index')], `${GLOBALS}
const content = g('Content');
const chapter = content.getChild('chapters').getChildAt(Math.max(0, g('Run').getChild('chapter').getAsNumber())).toJSObject();
const voices = chapter.voices || [];
if (!voices.length) return;
const index = ((Math.round(${arg('Index')}) % voices.length) + voices.length) % voices.length;
const v = voices[index];
const pattern = G(v.pattern);
const d = content.getChild('distortions').getChild(pattern).toJSObject() || {};
g('Run').getChild('voice').fromJSObject({
  index, kind: G(v.kind), says: G(v.says), pattern, patternName: G(d.name || ''), signal: G(d.signal || ''), question: G(d.question || ''), no: G(v.no), yes: G(v.yes),
});
`, 'Story'),
    stringExpression('StageClock', 'Clock of the stage', 'The time in the person\'s day while a stage of the chapter goes on (HH:MM), from the stage\'s start time at progress 0 to its end time at 1.',
      [param('Stage', 'expression', 'Stage index'), param('Progress', 'expression', 'Progress 0–1')], `${GLOBALS}
const chapter = g('Content').getChild('chapters').getChildAt(Math.max(0, g('Run').getChild('chapter').getAsNumber())).toJSObject();
const stage = (chapter.stages || [])[Math.round(${arg('Stage')})];
if (!stage) { eventsFunctionContext.returnValue = ''; return; }
const minutes = t => { const [h, m] = G(t).split(':').map(Number); return h * 60 + m; };
const from = minutes(stage.clock[0]);
let to = minutes(stage.clock[1]);
if (to < from) to += 24 * 60;
const p = Math.max(0, Math.min(1, ${arg('Progress')}));
const t = Math.round(from + (to - from) * p) % (24 * 60);
eventsFunctionContext.returnValue = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');`, 'Story'),
    condition('IsHeroOpen', 'Archangel is open', 'The archangel can be chosen: one of the first two, or the chapter that brings him is done.',
      'Archangel _PARAM1_ is open', [param('Id', 'string', 'Archangel id')], `${GLOBALS}
const index = g('Content').getChild('heroIndex').getChild(${arg('Id')}).getAsNumber();
const hero = g('Content').getChild('heroes').getChildAt(index).toJSObject();
const done = g('Save').getChild('done');
eventsFunctionContext.returnValue = !!hero && (hero.unlockedBy === '' || (done.hasChild(hero.unlockedBy) && done.getChild(hero.unlockedBy).getAsBoolean()));
`, 'Progress'),
    stringExpression('PipsText', 'Level pips text', 'Filled and empty dots: ●●●○○.', [param('Level', 'expression', 'Level'), param('Max', 'expression', 'Max')], `
const max = Math.max(0, Math.round(${arg('Max')})), level = Math.max(0, Math.min(max, Math.round(${arg('Level')})));
eventsFunctionContext.returnValue = '●'.repeat(level) + '○'.repeat(max - level);`, 'Text'),
  ];
}

// ─── Psalm150: the procedural soundtrack ────────────────────────────────────────────────────────

const psalm = body => `const audio = window.Psalm150;\nif (!audio) return;\n${body}`;

export const psalm150 = extension('Psalm150', 'Psalm 150 soundtrack',
  'The procedural soundtrack and sound effects of HolyHolyHoly (lyre, frame drum, flute, shofar), synthesised live.',
  'Wraps lib/psalm150.js, built from the 2D game\'s Web Audio engine (web/game/src/audio): a piece per chapter, adaptive layers (battle, boss, sabbath, victory) and effects tuned to the playing key. No audio files, works offline. The first click or key press unlocks audio.',
  'Audio',
  [
    action('Unlock', 'Unlock audio', 'Starts audio (also done automatically on the first click or key press).', 'Unlock audio', [], psalm('audio.unlock();'), 'Music'),
    action('SetMood', 'Music mood', 'Chooses the piece (a chapter id or "menu"), the scene (menu, battle, chapel, sabbath, boss, victory) and the intensity 0–1.',
      'Music: piece _PARAM1_, scene _PARAM2_, intensity _PARAM3_',
      [param('Track', 'string', 'Piece: chapter id or "menu"'), param('Scene', 'string', 'Scene: menu, battle, chapel, sabbath, boss or victory'), param('Intensity', 'expression', 'Intensity (0–1)')],
      psalm(`audio.setMood(${arg('Track')}, ${arg('Scene')}, ${arg('Intensity')});`), 'Music'),
    action('PlaySfx', 'Play an effect', 'Plays a sound effect; melodic effects use the scale step so they fit the music.',
      'Play effect _PARAM1_ (step _PARAM2_, pan _PARAM3_)',
      [param('Name', 'string', 'Effect: shoot, hit, hurt, seed, levelup, combo, digest, fire, flame, tier, ultimate, boss, revelation, rank, click, fall, door, grace, bell, weaken'), param('Step', 'expression', 'Scale step'), param('Pan', 'expression', 'Pan (-1 left … 1 right)')],
      psalm(`audio.sfx(${arg('Name')}, ${arg('Step')}, ${arg('Pan')});`), 'Effects'),
    action('SetVolumes', 'Volumes', 'Master, music and effects volumes (0–1).', 'Volumes: master _PARAM1_, music _PARAM2_, effects _PARAM3_',
      [param('Master', 'expression', 'Master (0–1)'), param('Music', 'expression', 'Music (0–1)'), param('Effects', 'expression', 'Effects (0–1)')],
      psalm(`audio.setVolumes(${arg('Master')}, ${arg('Music')}, ${arg('Effects')});`), 'Music'),
    action('SetMuted', 'Mute', 'Mutes or unmutes everything.', 'Mute: _PARAM1_', [param('Muted', 'yesorno', 'Muted')], psalm(`audio.setMuted(${arg('Muted')});`), 'Music'),
    action('NextTrack', 'Next variation', 'The current piece moves on to its next variation.', 'Next variation of the music', [], psalm('audio.nextTrack();'), 'Music'),
    action('SetHeartRate', 'Heart rate swell', 'A soft swell under the music at the player\'s heart rate (0 = off).', 'Heart rate swell: _PARAM1_ bpm',
      [param('Bpm', 'expression', 'Beats per minute (0 = off)')], psalm(`audio.setHeartRate(${arg('Bpm')});`), 'Music'),
    stringExpression('NowPlaying', 'Now playing', 'Name of the piece and variation now playing.', [],
      `const audio = window.Psalm150;\neventsFunctionContext.returnValue = audio ? audio.nowPlaying() : '';`, 'Music'),
  ],
  [{ resourceName: 'lib/psalm150.js', includePosition: 'last' }]);

// ─── MendiFocus: the band and the focus multiplier ──────────────────────────────────────────────

const focus = (body, fallback = '') => `const focus = window.MendiFocus;\nif (!focus) { ${fallback} return; }\n${body}`;
const ret = (expr, fallback) => focus(`eventsFunctionContext.returnValue = ${expr};`, `eventsFunctionContext.returnValue = ${fallback};`);

export const mendiFocus = extension('MendiFocus', 'Mendi focus',
  'Focus that charges the Fire of the Spirit: standing still, or the Mendi fNIRS band (optional).',
  'Wraps lib/mendi-focus.js, built from BrainLink\'s Mendi Web Bluetooth adapter and fNIRS pipeline and the 2D game\'s focus charger. Without the band, standing still is focus (multiplier up to ×1.5); the band adds focus while moving (up to ×3). It never lowers anything. Data stays on the device. Web Bluetooth works in Chrome and Edge (desktop and Android) and in Bluefy on iOS.',
  'Input',
  [
    action('Connect', 'Connect the band', 'Opens the browser\'s Bluetooth chooser (call it right after a click or tap).', 'Connect the Mendi band', [], focus('focus.connect();'), 'Band'),
    action('Disconnect', 'Disconnect the band', 'Disconnects the band.', 'Disconnect the Mendi band', [], focus('focus.disconnect();'), 'Band'),
    action('Update', 'Update focus', 'One tick of the focus charger; call it every frame during play. Standing still for more than 0.12 s counts as focus (as in the 2D game).', 'Update focus (delta _PARAM1_ s, standing still for _PARAM2_ s)',
      [param('Delta', 'expression', 'Seconds since the last frame'), param('StillSeconds', 'expression', 'How long the angel has stood still (s)')], focus(`focus.update(${arg('Delta')}, ${arg('StillSeconds')} > 0.12);`), 'Focus'),
    action('Reset', 'Reset focus', 'A new chapter starts the focus streak afresh.', 'Reset focus', [], focus('focus.reset();'), 'Focus'),
    condition('IsSupported', 'Bluetooth available', 'The browser supports Web Bluetooth.', 'Web Bluetooth is available', [],
      ret('focus.supported()', 'false'), 'Band'),
    condition('IsBandActive', 'Band active', 'The band is connected (calibrating or ready).', 'The Mendi band is active', [],
      ret("['calibrating', 'ready', 'paused'].includes(focus.status())", 'false'), 'Band'),
    condition('TierJustRose', 'Multiplier rose', 'True on the frame the focus multiplier went up.', 'The focus multiplier just rose', [],
      ret('focus.tierUp()', 'false'), 'Focus'),
    condition('IsFocused', 'Focused', 'Focus is at or above the threshold (or within the grace period).', 'The player is focused', [],
      ret('focus.focused()', 'false'), 'Focus'),
    expression('Level', 'Focus level', 'Smoothed focus 0–1.', [], ret('focus.level()', '0'), 'Focus'),
    expression('Threshold', 'Focus threshold', 'Focus level that counts as focused.', [], ret('focus.threshold', '0.55'), 'Focus'),
    expression('Multiplier', 'Multiplier', 'Focus multiplier: 1, 1.5, 2 or 3.', [], ret('focus.multiplier()', '1'), 'Focus'),
    expression('ToNext', 'Progress to the next multiplier', '0–1.', [], ret('focus.toNext()', '0'), 'Focus'),
    expression('ChargeFactor', 'Charge factor', 'Charge per second in units of the base rate.', [], ret('focus.chargeFactor()', '0'), 'Focus'),
    expression('HeldSeconds', 'Focus held', 'Seconds of focus held without a break.', [], ret('focus.held()', '0'), 'Focus'),
    expression('HeartRate', 'Heart rate', 'Heart rate from the band (0 if none).', [], ret('focus.heartRate()', '0'), 'Band'),
    expression('BaselineProgress', 'Calibration progress', '0–1 while the band calibrates.', [], ret('focus.baselineProgress()', '0'), 'Band'),
    stringExpression('Source', 'Focus source', '"band", "still" or "none".', [], ret('focus.source()', "'none'"), 'Focus'),
    stringExpression('Status', 'Band status', 'unsupported, off, connecting, calibrating, ready, paused or error.', [], ret('focus.status()', "'unsupported'"), 'Band'),
    stringExpression('StatusText', 'Band status (Polish)', 'A sentence for the player.', [], focus(`
const texts = {
  unsupported: 'Ta przeglądarka nie obsługuje Bluetooth. Użyj Chrome lub Edge (na iPhonie: Bluefy).',
  off: 'Opaska niepołączona. Skupienie daje bezruch (do ×1,5).',
  connecting: 'Łączenie z opaską…',
  calibrating: 'Kalibracja opaski: ' + Math.round(focus.baselineProgress() * 100) + '%. Spokojnie oddychaj.',
  ready: 'Opaska gotowa: skupienie liczy się także w ruchu (do ×3).',
  paused: 'Sygnał wstrzymany: ruch głowy albo słaby kontakt.',
  error: focus.error() || 'Nie udało się połączyć z opaską.',
};
eventsFunctionContext.returnValue = texts[focus.status()] || '';`, "eventsFunctionContext.returnValue = '';"), 'Band'),
  ],
  [{ resourceName: 'lib/mendi-focus.js', includePosition: 'last' }]);

// ─── UI builders: events-based functions (reusable in every scene) ─────────────────────────────
import { A as Ai, q as qq } from './dsl.mjs';

const objParam = (name, type, description) => ({ name, type: 'objectListOrEmptyIfJustDeclared', supplementaryInformation: type, description });
const N = n => `GetArgumentAsNumber(${qq(n)})`;
const S = n => `GetArgumentAsString(${qq(n)})`;

function eventsFn(name, fullName, description, sentence, parameters, events, group = 'UI') {
  return { name, fullName, description, sentence, functionType: 'Action', group, private: false, events, parameters, objectGroups: [] };
}

export function uiFunctions() {
  const std = (actions, events = []) => ({ type: 'BuiltinCommonInstructions::Standard', conditions: [], actions, events });
  // an overlay panel (Panel not empty) and everything on it draw above the base screen
  const above = (obj, panelArg) => ({
    type: 'BuiltinCommonInstructions::Standard',
    conditions: [{ type: { value: 'BuiltinCommonInstructions::CompareStrings' }, parameters: [S(panelArg), '!=', '""'] }],
    actions: [Ai('SetZOrder', obj, '+', '200')],
    events: [],
  });
  // a text taller than its room is set smaller, a point at a time, down to 60 % of its size; the
  // room and the size are kept on the object, so HolyHoly::FitTexts fits it again when it changes
  const fit = (obj, heightArg, margin = 0) => js(`
const maxH = Math.max(0, eventsFunctionContext.getArgument(${JSON.stringify(heightArg)}) - ${margin});
for (const t of objects) {
  const vars = t.getVariables();
  vars.get('MaxH').setNumber(maxH);
  vars.get('Size').setNumber(t.getCharacterSize());
  vars.get('FitText').setString(t.getText());
  const smallest = Math.max(10, Math.round(t.getCharacterSize() * 0.6));
  let size = t.getCharacterSize();
  while (maxH > 0 && t.getHeight() > maxH && size > smallest) t.setCharacterSize(--size);
}`, obj);
  return [
    eventsFn('MakeButton', 'Create a button', 'Creates a 9-patch button with a centred caption. Clicking it sets Ui.clicked to its action (see the UI external events).',
      'Button _PARAM1_ + _PARAM2_ at _PARAM3_;_PARAM4_ (_PARAM5_×_PARAM6_): _PARAM7_ → _PARAM8_',
      [objParam('Button', 'PanelSpriteObject::PanelSprite', 'Button'), objParam('Label', 'TextObject::Text', 'Caption text'),
        { name: 'X', type: 'expression', description: 'X' }, { name: 'Y', type: 'expression', description: 'Y' },
        { name: 'W', type: 'expression', description: 'Width' }, { name: 'H', type: 'expression', description: 'Height' },
        { name: 'Caption', type: 'string', description: 'Caption' }, { name: 'Action', type: 'string', description: 'Action' },
        { name: 'Arg', type: 'expression', description: 'Argument' }, { name: 'Panel', type: 'string', description: 'Panel' },
        { name: 'Layer', type: 'layer', description: 'Layer' }],
      [std([
        Ai('Create', 'Button', N('X'), N('Y'), 'Layer'),
        Ai('ResizableCapability::ResizableBehavior::SetSize', 'Button', 'Resizable', N('W'), N('H')),
        Ai('SetStringObjectVariable', 'Button', 'Action', '=', S('Action')),
        Ai('SetNumberObjectVariable', 'Button', 'Arg', '=', N('Arg')),
        Ai('SetStringObjectVariable', 'Button', 'Panel', '=', S('Panel')),
        Ai('SetZOrder', 'Button', '=', '100'),
        Ai('Create', 'Label', N('X'), N('Y'), 'Layer'),
        Ai('TextContainerCapability::TextContainerBehavior::SetValue', 'Label', 'Text', '=', S('Caption')),
        Ai('TextObject::SetTextAlignment', 'Label', qq('center')),
        Ai('TextObject::SetWrapping', 'Label', 'yes'),
        Ai('TextObject::WrappingWidth', 'Label', '=', `${N('W')} - 16`),
        Ai('SetXY', 'Label', '=', `${N('X')} + 8`, '=', `${N('Y')} + (${N('H')} - Label.Height()) / 2`),
        Ai('SetStringObjectVariable', 'Label', 'Panel', '=', S('Panel')),
        Ai('SetStringObjectVariable', 'Label', 'Action', '=', S('Action')),
        Ai('SetNumberObjectVariable', 'Label', 'Arg', '=', N('Arg')),
        Ai('SetZOrder', 'Label', '=', '101'),
      ], [above('Button', 'Panel'), above('Label', 'Panel'), fit('Label', 'H', 8), std([Ai('SetXY', 'Label', '=', `${N('X')} + 8`, '=', `${N('Y')} + (${N('H')} - Label.Height()) / 2`)])])]),
    eventsFn('MakeText', 'Create a text', 'Creates a wrapped text, aligned left, center or right inside the given width. With a maximum height, a text that would run longer is set smaller (down to 60 %) until it fits.',
      'Text _PARAM1_ at _PARAM2_;_PARAM3_ width _PARAM4_: _PARAM5_ (_PARAM6_, key _PARAM7_, panel _PARAM8_, at most _PARAM10_ high)',
      [objParam('Text', 'TextObject::Text', 'Text object'), { name: 'X', type: 'expression', description: 'X' }, { name: 'Y', type: 'expression', description: 'Y' },
        { name: 'W', type: 'expression', description: 'Width' }, { name: 'Content', type: 'string', description: 'Text' },
        { name: 'Align', type: 'stringWithSelector', supplementaryInformation: '["left","center","right"]', description: 'Alignment' },
        { name: 'Key', type: 'string', description: 'Key (for updates)' }, { name: 'Panel', type: 'string', description: 'Panel' },
        { name: 'Layer', type: 'layer', description: 'Layer' }, { name: 'MaxH', type: 'expression', description: 'Maximum height (0: any)' }],
      [std([
        Ai('Create', 'Text', N('X'), N('Y'), 'Layer'),
        Ai('TextContainerCapability::TextContainerBehavior::SetValue', 'Text', 'Text', '=', S('Content')),
        Ai('TextObject::SetTextAlignment', 'Text', S('Align')),
        Ai('TextObject::SetWrapping', 'Text', 'yes'),
        Ai('TextObject::WrappingWidth', 'Text', '=', N('W')),
        Ai('SetStringObjectVariable', 'Text', 'Key', '=', S('Key')),
        Ai('SetStringObjectVariable', 'Text', 'Panel', '=', S('Panel')),
        Ai('SetZOrder', 'Text', '=', '90'),
      ], [above('Text', 'Panel'), fit('Text', 'MaxH')])]),
    eventsFn('MakePanel', 'Create a panel', 'Creates a 9-patch panel (background of a dialog or a card).',
      'Panel _PARAM1_ at _PARAM2_;_PARAM3_ (_PARAM4_×_PARAM5_), key _PARAM6_, panel _PARAM7_',
      [objParam('Panel', 'PanelSpriteObject::PanelSprite', 'Panel object'), { name: 'X', type: 'expression', description: 'X' }, { name: 'Y', type: 'expression', description: 'Y' },
        { name: 'W', type: 'expression', description: 'Width' }, { name: 'H', type: 'expression', description: 'Height' },
        { name: 'Key', type: 'string', description: 'Key' }, { name: 'PanelName', type: 'string', description: 'Panel' },
        { name: 'Layer', type: 'layer', description: 'Layer' }],
      [std([
        Ai('Create', 'Panel', N('X'), N('Y'), 'Layer'),
        Ai('ResizableCapability::ResizableBehavior::SetSize', 'Panel', 'Resizable', N('W'), N('H')),
        Ai('SetStringObjectVariable', 'Panel', 'Key', '=', S('Key')),
        Ai('SetStringObjectVariable', 'Panel', 'Panel', '=', S('PanelName')),
        Ai('SetZOrder', 'Panel', '=', '50'),
      ], [above('Panel', 'PanelName')])]),
  ];
}
