// libGD bootstrap + metadata helpers for the project generator.
import { gd, loadProject, saveProject, exportProject } from 'gdcore-tools';
export { gd, loadProject, saveProject, exportProject };

export const platform = gd.JsPlatform.get();

const cache = new Map();
/** Parameter metadata of an action/condition: [{type, codeOnly, optional, def, extra}] */
export function instrMeta(kind, type) {
  const key = kind + ':' + type;
  if (cache.has(key)) return cache.get(key);
  const m = kind === 'A' ? gd.MetadataProvider.getActionMetadata(platform, type) : gd.MetadataProvider.getConditionMetadata(platform, type);
  if (gd.MetadataProvider.isBadInstructionMetadata(m)) { cache.set(key, null); return null; }
  const params = [];
  for (let i = 0; i < m.getParametersCount(); i++) {
    const p = m.getParameter(i);
    params.push({ type: p.getType(), codeOnly: p.isCodeOnly(), optional: p.isOptional(), def: p.getDefaultValue(), extra: p.getExtraInfo(), name: p.getName() });
  }
  const r = { params, async: m.isAsync ? m.isAsync() : false };
  cache.set(key, r);
  return r;
}

/** Default serialized JSON of a built-in object type (fresh instance from libGD). */
const objCache = new Map();
export function defaultObject(type) {
  if (objCache.has(type)) return structuredClone(objCache.get(type));
  const project = gd.ProjectHelper.createNewGDJSProject();
  const layout = project.insertNewLayout('S', 0);
  const o = layout.getObjects().insertNewObject(project, type, 'O', 0);
  const el = new gd.SerializerElement();
  o.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  project.delete();
  objCache.set(type, json);
  return structuredClone(json);
}

/** Default serialized JSON of a built-in behavior type. */
export function defaultBehavior(type, name, objectType = 'Sprite') {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const layout = project.insertNewLayout('S', 0);
  const o = layout.getObjects().insertNewObject(project, objectType, 'O', 0);
  o.addNewBehavior(project, type, name);
  const el = new gd.SerializerElement();
  o.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  project.delete();
  const b = json.behaviors.find(x => x.name === name);
  if (!b) throw new Error('No behavior ' + type);
  return b;
}

export function defaultProjectJson() {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const el = new gd.SerializerElement();
  project.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  project.delete();
  return json;
}

export function defaultLayoutJson() {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const layout = project.insertNewLayout('S', 0);
  const el = new gd.SerializerElement();
  layout.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  project.delete();
  return json;
}
