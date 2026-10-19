// Generates the GDevelop project of HolyHolyHoly 3D into web/game3d/project (folder project).
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject, saveProject, defaultLayoutJson } from './gd.mjs';
import { projectBase, resources, officialExtensions, PROJECT_DIR } from './base.mjs';
import { holyHoly, psalm150, mendiFocus, uiFunctions } from './ext.mjs';
import { errors, setContext } from './dsl.mjs';

const TMP = join(tmpdir(), 'holyholyholy3d-generator');
mkdirSync(TMP, { recursive: true });

const extensions = () => {
  const h = structuredClone(holyHoly);
  return [...officialExtensions(['SpriteMultitouchJoystick', 'ParticleEmitter3D', 'ShakeObject3D', 'FireBullet']), h, psalm150, mendiFocus];
};

// Pass 1: declare the extensions' metadata, so the DSL can check their instructions.
{
  const p = projectBase();
  p.resources.resources = resources();
  const exts = extensions();
  exts.find(e => e.name === 'HolyHoly').eventsFunctions.push(...uiFunctions());
  p.eventsFunctionsExtensions = exts;
  p.properties.folderProject = false;
  writeFileSync(join(TMP, 'pass1.json'), JSON.stringify(p));
  await loadProject(join(TMP, 'pass1.json'));
}

const { globalVariables, globalObjects, UI_ALL, uiExternalEvents } = await import('./ui.mjs');
// the scenes, in the order of a first play: menu, the Ladder (map), the archangels, a story scene, the fight, the revelation
const sceneModules = [
  (await import('./scene-title.mjs')).titleScene,
  (await import('./scene-ladder.mjs')).ladderScene,
  (await import('./scene-synaxis.mjs')).synaxisScene,
  (await import('./scene-story.mjs')).storyScene,
  (await import('./scene-arena.mjs')).arenaScene,
  (await import('./scene-revelation.mjs')).revelationScene,
];

/** Objects grouped in folders, as in the editor's object list; unlisted objects stay at the root. */
function folderStructure(names, folders) {
  const inFolder = new Set(Object.values(folders).flat());
  return {
    folderName: '__ROOT',
    children: [
      ...Object.entries(folders).map(([folderName, objects]) => ({ folderName, children: objects.filter(o => names.includes(o)).map(objectName => ({ objectName })) })),
      ...names.filter(n => !inFolder.has(n)).map(objectName => ({ objectName })),
    ],
  };
}

function layoutJson(sc) {
  setContext(sc.name);
  const l = defaultLayoutJson();
  Object.assign(l, {
    name: sc.name,
    mangledName: sc.name.replace(/[^A-Za-z0-9]/g, '_'),
    r: sc.background[0], v: sc.background[1], b: sc.background[2],
    layers: sc.layers,
    objects: sc.objects,
    instances: sc.instances,
    events: sc.events,
    variables: sc.variables ?? [],
    objectsGroups: (sc.groups ?? []).map(([name, objects]) => ({ name, objects: objects.map(o => ({ name: o })) })),
    objectsFolderStructure: folderStructure(sc.objects.map(o => o.name), sc.folders ?? {}),
    behaviorsSharedData: [],
  });
  return l;
}

const p = projectBase();
p.resources.resources = resources();
const exts = extensions();
exts.find(e => e.name === 'HolyHoly').eventsFunctions.push(...uiFunctions());
p.eventsFunctionsExtensions = exts;
p.variables = globalVariables();
p.objects = globalObjects();
p.objectsFolderStructure = folderStructure(p.objects.map(o => o.name), { 'Interfejs (UI)': p.objects.map(o => o.name) });
p.objectsGroups = [{ name: 'UiAll', objects: UI_ALL.map(name => ({ name })) }];
const scenes = sceneModules.map(f => f());
p.layouts = scenes.map(layoutJson);
p.firstLayout = 'Title';
setContext('UI external events');
p.externalEvents = [{ name: 'UI', associatedLayout: 'Title', lastChangeTimeStamp: 0, events: uiExternalEvents() }];
p.externalLayouts = scenes.flatMap(sc => sc.externalLayouts ?? []);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const GENERATED = join(PROJECT_DIR, '.generated.json');
writeFileSync(GENERATED, JSON.stringify(p, null, 1));
const { loadGameProject, validateProject, exportGame, saveGameProject } = await import('../tools/gdevelop.mjs');
const project = await loadGameProject(GENERATED);
rmSync(GENERATED);
const issues = validateProject(project);
const diag = await exportGame(project, join(TMP, 'export'));
console.log(`scenes ${project.getLayoutsCount()}, issues ${issues.length}, diagnostics ${diag.length}`);
if (issues.length || diag.length) {
  console.log([...issues, ...diag].slice(0, 60).join('\n'));
  process.exitCode = 1;
}

/** The files of a folder project (the main file and one JSON per scene, external events, extension). */
function projectFiles(root) {
  const out = ['HolyHolyHoly3D.json'];
  for (const dir of ['layouts', 'externalLayouts', 'externalEvents', 'eventsFunctionsExtensions']) {
    if (existsSync(join(root, dir))) out.push(...readdirSync(join(root, dir)).map(f => `${dir}/${f}`));
  }
  return out.sort();
}

if (process.argv.includes('--check')) {
  // the saved project must be exactly what the generator makes (the generator is the source)
  const dir = join(TMP, 'check');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'HolyHolyHoly3D.json'), '{}');
  await saveGameProject(project, join(dir, 'HolyHolyHoly3D.json'));
  const expected = projectFiles(dir), actual = projectFiles(PROJECT_DIR);
  const differ = [...new Set([...expected, ...actual])].filter(f => !existsSync(join(dir, f)) || !existsSync(join(PROJECT_DIR, f)) || readFileSync(join(dir, f), 'utf8') !== readFileSync(join(PROJECT_DIR, f), 'utf8'));
  if (issues.length || diag.length || differ.length) {
    console.error(`✗ project/ is not what generator/ makes: ${differ.join(', ') || 'see the issues above'} (run npm run game3d:generate)`);
    process.exit(1);
  }
  console.log('✓ project/ matches generator/');
}

if (process.argv.includes('--save') && !issues.length && !diag.length) {
  for (const dir of ['layouts', 'externalLayouts', 'externalEvents', 'eventsFunctionsExtensions']) rmSync(join(PROJECT_DIR, dir), { recursive: true, force: true });
  const file = join(PROJECT_DIR, 'HolyHolyHoly3D.json');
  if (!existsSync(file)) writeFileSync(file, '{}');
  await saveGameProject(project, file);
  console.log('saved', file);
}
