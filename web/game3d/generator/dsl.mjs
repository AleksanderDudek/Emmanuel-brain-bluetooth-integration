// A small DSL that writes GDevelop events JSON. Instructions are checked against libGD metadata:
// code-only parameters are filled in automatically, missing optional ones get their defaults.
import { instrMeta } from './gd.mjs';

export const errors = [];
let context = '';
export const setContext = c => { context = c; };

/** A string literal inside a GDevelop expression. */
export const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';

function ins(kind, type, args) {
  const meta = instrMeta(kind, type);
  if (!meta) {
    errors.push(`${context}: unknown ${kind === 'A' ? 'action' : 'condition'} ${type}`);
    return { type: { value: type }, parameters: args.map(String) };
  }
  const params = [];
  let i = 0;
  for (const p of meta.params) {
    if (p.codeOnly) {
      params.push(p.def ?? '');
      continue;
    }
    if (i < args.length) params.push(String(args[i++]));
    else if (p.optional) params.push(p.def ?? '');
    else {
      errors.push(`${context}: ${type} missing parameter ${p.name || p.type}`);
      params.push('');
    }
  }
  if (i < args.length) errors.push(`${context}: ${type} got ${args.length} args, uses ${i}`);
  const out = { type: { value: type }, parameters: params };
  if (meta.async) out.type.await = true;
  return out;
}

export const A = (type, ...args) => ins('A', type, args);
export const C = (type, ...args) => ins('C', type, args);
export const NOT = c => ({ ...c, type: { ...c.type, inverted: true } });
export const OR = (...conds) => ({ type: { value: 'BuiltinCommonInstructions::Or' }, parameters: [], subInstructions: conds });
export const AND = (...conds) => ({ type: { value: 'BuiltinCommonInstructions::And' }, parameters: [], subInstructions: conds });
export const ONCE = () => C('BuiltinCommonInstructions::Once');

/** A variable declaration from a JS value: numbers, strings, booleans, arrays and structures (recursively). */
export function declare(name, value) {
  if (typeof value === 'string') return { name, type: 'string', value };
  if (typeof value === 'boolean') return { name, type: 'boolean', value };
  if (Array.isArray(value)) return { name, type: 'array', children: value.map(x => { const d = declare('', x); delete d.name; return d; }) };
  if (value && typeof value === 'object') return { name, type: 'structure', children: Object.entries(value).map(([k, x]) => declare(k, x)) };
  return { name, type: 'number', value: value ?? 0 };
}

const localVars = vars => (vars ? Object.entries(vars).map(([name, v]) => declare(name, v)) : undefined);

function checkEvents(events) {
  for (const e of events) if (!e || typeof e.type !== 'string') errors.push(`${context}: an instruction was put in an events list: ${JSON.stringify(e).slice(0, 120)}`);
  return events;
}
function checkInstructions(list, what) {
  for (const i of list) if (!i || typeof i.type !== 'object' || !i.type.value) errors.push(`${context}: not an instruction in ${what}: ${JSON.stringify(i).slice(0, 120)}`);
  return list;
}

/**
 * GDevelop picks every object created in an event: a second "Create" of the same object in the same
 * event would make the following actions apply to both. So when an action list creates more than
 * one object, each creation and the actions that follow it go into their own sub-event.
 */
const CREATIONS = new Set(['Create', 'CreateByName', 'HolyHoly::MakeButton', 'HolyHoly::MakeText', 'HolyHoly::MakePanel']);
function splitCreations(actions, events) {
  const count = actions.filter(a => CREATIONS.has(a.type.value)).length;
  if (count < 2) return [actions, events];
  const first = actions.findIndex(a => CREATIONS.has(a.type.value));
  const kept = actions.slice(0, first);
  const chunks = [];
  for (const a of actions.slice(first)) {
    if (CREATIONS.has(a.type.value) || !chunks.length) chunks.push([a]);
    else chunks[chunks.length - 1].push(a);
  }
  return [kept, [...chunks.map(chunk => ({ type: 'BuiltinCommonInstructions::Standard', conditions: [], actions: chunk, events: [] })), ...events]];
}

export function ev(conditions, actions, events = [], { vars, disabled } = {}) {
  checkInstructions(conditions, 'conditions');
  checkInstructions(actions, 'actions');
  checkEvents(events);
  [actions, events] = splitCreations(actions, events);
  const e = { type: 'BuiltinCommonInstructions::Standard', conditions, actions, events };
  if (vars) e.variables = localVars(vars);
  if (disabled) e.disabled = true;
  return e;
}

export const comment = text => ({ type: 'BuiltinCommonInstructions::Comment', color: { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 }, comment: text });

const GROUP_COLORS = [[74, 144, 226], [126, 87, 194], [76, 175, 80], [255, 152, 0], [233, 30, 99], [0, 150, 136], [121, 85, 72], [96, 125, 139]];
let groupIndex = 0;
export function group(name, events, { folded = true } = {}) {
  const [r, g, b] = GROUP_COLORS[groupIndex++ % GROUP_COLORS.length];
  return { type: 'BuiltinCommonInstructions::Group', name, source: '', folded, colorR: r, colorG: g, colorB: b, creationTime: 0, events };
}

export const forEach = (object, conditions, actions, events = [], opts = {}) => {
  [actions, events] = splitCreations(actions, events);
  const e = { type: 'BuiltinCommonInstructions::ForEach', object, conditions, actions, events };
  if (opts.vars) e.variables = localVars(opts.vars);
  return e;
};

export const repeat = (expression, conditions, actions, events = [], { vars, index } = {}) => {
  checkEvents(events);
  [actions, events] = splitCreations(actions, events);
  const e = { type: 'BuiltinCommonInstructions::Repeat', repeatExpression: String(expression), conditions, actions, events };
  if (index) e.loopIndexVariable = index;
  if (vars) e.variables = localVars(vars);
  return e;
};

export const whileEv = (whileConditions, conditions, actions, events = []) =>
  ({ type: 'BuiltinCommonInstructions::While', whileConditions, conditions, actions, events });

export const forEachChild = (iterable, value, key, conditions, actions, events = [], opts = {}) => {
  checkEvents(events);
  [actions, events] = splitCreations(actions, events);
  const e = { type: 'BuiltinCommonInstructions::ForEachChildVariable', iterableVariableName: iterable, valueIteratorVariableName: value, keyIteratorVariableName: key, conditions, actions, events };
  if (opts.vars) e.variables = localVars(opts.vars);
  return e;
};

export const js = (code, parameterObjects = '') => ({ type: 'BuiltinCommonInstructions::JsCode', inlineCode: code.trim() + '\n', parameterObjects, useStrict: true, eventsSheetExpanded: true });

export const link = target => ({ type: 'BuiltinCommonInstructions::Link', include: { includeConfig: 0 }, target });

// ─── shorthands ───────────────────────────────────────────────────────────────────────────────

export const set = (v, op, e) => A('SetNumberVariable', v, op, e);
export const setS = (v, op, e) => A('SetStringVariable', v, op, e);
export const setB = (v, b) => A('SetBooleanVariable', v, b ? 'True' : 'False');
export const is = (v, op, e) => C('NumberVariable', v, op, e);
export const isS = (v, op, e) => C('StringVariable', v, op, e);
export const isB = (v, b = true) => C('BooleanVariable', v, b ? 'True' : 'False');
export const cmp = (a, op, b) => C('BuiltinCommonInstructions::CompareNumbers', a, op, b);
export const cmpS = (a, op, b) => C('BuiltinCommonInstructions::CompareStrings', a, op, b);

export const oset = (o, v, op, e) => A('SetNumberObjectVariable', o, v, op, e);
export const osetS = (o, v, op, e) => A('SetStringObjectVariable', o, v, op, e);
export const osetB = (o, v, b) => A('SetBooleanObjectVariable', o, v, b ? 'True' : 'False');
export const ois = (o, v, op, e) => C('NumberObjectVariable', o, v, op, e);
export const oisS = (o, v, op, e) => C('StringObjectVariable', o, v, op, e);
export const oisB = (o, v, b = true) => C('BooleanObjectVariable', o, v, b ? 'True' : 'False');

export const text = (o, e) => A('TextContainerCapability::TextContainerBehavior::SetValue', o, 'Text', '=', e);
export const opacity = (o, e, op = '=') => A('OpacityCapability::OpacityBehavior::SetValue', o, 'Opacity', op, e);
export const anim = (o, name) => A('AnimatableCapability::AnimatableBehavior::SetName', o, 'Animation', '=', q(name));
export const animE = (o, expr) => A('AnimatableCapability::AnimatableBehavior::SetName', o, 'Animation', '=', expr);
export const scale = (o, e) => A('ScalableCapability::ScalableBehavior::SetValue', o, 'Scale', '=', e);
export const setZ = (o, e, op = '=') => A('Scene3D::Base3DBehavior::SetZ', o, 'Object3D', op, e);
export const size = (o, w, h) => A('ResizableCapability::ResizableBehavior::SetSize', o, 'Resizable', w, h);
export const width = (o, w) => A('ResizableCapability::ResizableBehavior::SetWidth', o, 'Resizable', '=', w);
export const pos = (o, x, y) => A('SetXY', o, '=', x, '=', y);
export const center = (o, x, y) => A('SetCenter', o, '=', x, '=', y);
export const create = (o, x, y, layer = '""') => A('Create', o, x, y, layer);
export const del = o => A('Delete', o);
export const hide = o => A('Hide', o);
export const show = o => A('Show', o);
export const tint = (o, c) => A('PanelSpriteObject::SetColor', o, c);
export const tweenOpacity = (o, id, to, secs, ease = 'easeOutQuad', destroy = false) =>
  A('Tween::TweenBehavior::AddObjectOpacityTween2', o, 'Tween', q(id), to, q(ease), secs, destroy ? 'yes' : 'no');
export const tweenPos = (o, id, x, y, secs, ease = 'easeOutQuad', destroy = false) =>
  A('Tween::TweenBehavior::AddObjectPositionTween2', o, 'Tween', q(id), x, y, q(ease), secs, destroy ? 'yes' : 'no');
export const tweenScale = (o, id, to, secs, ease = 'easeOutQuad', destroy = false) =>
  A('Tween::TweenBehavior::AddObjectScaleTween3', o, 'Tween', q(id), to, q(ease), secs, destroy ? 'yes' : 'no', 'yes');
export const tweenWidth = (o, id, to, secs, ease = 'easeOutQuad') =>
  A('Tween::TweenBehavior::AddObjectWidthTween2', o, 'Tween', q(id), to, q(ease), secs, 'no');
export const key = k => C('KeyFromTextPressed', q(k));
export const keyJust = k => C('KeyFromTextJustPressed', q(k));
export const keyUp = k => C('KeyFromTextReleased', q(k));
export const begins = () => C('SceneJustBegins');
export const wait = s => A('Wait', s);
export const scene = name => A('Scene', q(name), 'yes');
export const dt = 'TimeDelta()';
