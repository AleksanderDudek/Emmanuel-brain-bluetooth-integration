/**
 * GDevelop without the editor: load the HolyHolyHoly 3D project with GDevelop's own core library
 * (libGD.js, from the pinned `gdcore-tools` package), check it the way the editor would, and
 * export it as an HTML5 game.
 *
 * The checks go beyond the editor's export, so a typo fails the build instead of silently doing
 * nothing:
 *   - in scenes, external events and this project's own extensions (author "HolyHoly"; official
 *     store extensions are taken as published), every action and condition must exist with the
 *     parameters its metadata declares, and yes/no and true/false parameters must be literals
 *     (GDevelop compiles anything else to "false" without a word);
 *   - in scenes and external events, every expression (parameters, Repeat counts) must parse and
 *     resolve: objects, behaviors, variables including local ones, functions. Extension functions
 *     use their own scopes (parameters, properties) and are left to GDevelop's code generation.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gd, loadProject, exportProject, saveProject } from 'gdcore-tools';
import { PROJECT_DIR, PROJECT_FILE } from './paths.mjs';

export { gd };

export async function loadGameProject(file = PROJECT_FILE) {
  const project = await loadProject(file);
  for (let i = 0; i < project.getLayoutsCount(); i++) project.getLayoutAt(i).updateBehaviorsSharedData(project);
  return project;
}

const platform = () => gd.JsPlatform.get();

/** Literal values a choice parameter accepts ('' = not set, for optional parameters). */
const LITERALS = { yesorno: ['yes', 'no', ''], trueorfalse: ['True', 'False', ''] };

function rootTypeOf(parameterType) {
  if (gd.ParameterMetadata.isExpression('number', parameterType)) return 'number';
  if (gd.ParameterMetadata.isExpression('string', parameterType)) return 'string';
  return null;
}

function eventInstructionLists(event) {
  switch (event.getType()) {
    case 'BuiltinCommonInstructions::Standard': {
      const e = gd.asStandardEvent(event);
      return [e.getConditions(), e.getActions()];
    }
    case 'BuiltinCommonInstructions::Repeat': {
      const e = gd.asRepeatEvent(event);
      return [e.getConditions(), e.getActions()];
    }
    case 'BuiltinCommonInstructions::While': {
      const e = gd.asWhileEvent(event);
      return [e.getWhileConditions(), e.getConditions(), e.getActions()];
    }
    case 'BuiltinCommonInstructions::ForEach': {
      const e = gd.asForEachEvent(event);
      return [e.getConditions(), e.getActions()];
    }
    case 'BuiltinCommonInstructions::ForEachChildVariable': {
      const e = gd.asForEachChildVariableEvent(event);
      return [e.getConditions(), e.getActions()];
    }
    default:
      return [];
  }
}

function checkExpression(issues, where, scoped, rootType, expression) {
  if (!scoped || expression.trim() === '') return;
  const parser = new gd.ExpressionParser2();
  const node = parser.parseExpression(expression).get();
  const validator = new gd.ExpressionValidator(platform(), scoped, rootType, '');
  node.visit(validator);
  const errors = validator.getFatalErrors();
  for (let i = 0; i < errors.size(); i++) issues.push(`${where}: ${errors.at(i).getMessage()} in \`${expression}\``);
  validator.delete();
  parser.delete();
}

function checkInstructions(issues, where, list, isCondition, scoped) {
  for (let i = 0; i < list.size(); i++) {
    const instruction = list.get(i);
    const type = instruction.getType();
    const metadata = isCondition
      ? gd.MetadataProvider.getConditionMetadata(platform(), type)
      : gd.MetadataProvider.getActionMetadata(platform(), type);
    if (gd.MetadataProvider.isBadInstructionMetadata(metadata)) {
      issues.push(`${where}: unknown ${isCondition ? 'condition' : 'action'} ${type}`);
      continue;
    }
    const expected = metadata.getParametersCount();
    if (instruction.getParametersCount() !== expected) {
      issues.push(`${where}: ${type} has ${instruction.getParametersCount()} parameters, expected ${expected}`);
    }
    for (let p = 0; p < Math.min(expected, instruction.getParametersCount()); p++) {
      const parameter = metadata.getParameter(p);
      const value = instruction.getParameter(p).getPlainString();
      if (!parameter.isOptional() && !parameter.isCodeOnly() && value === '' && parameter.getType() !== 'layer') {
        issues.push(`${where}: ${type} parameter ${p + 1} (${parameter.getType()}) is empty`);
      }
      const literals = LITERALS[parameter.getType()];
      if (literals && !parameter.isCodeOnly() && !literals.includes(value)) {
        issues.push(`${where}: ${type} parameter ${p + 1} (${parameter.getType()}) must be ${literals.filter(Boolean).join(' or ')}, not \`${value}\``);
      }
      const rootType = rootTypeOf(parameter.getType());
      if (rootType) checkExpression(issues, `${where} ${type}#${p + 1}`, scoped, rootType, value);
    }
    if (type === 'BuiltinCommonInstructions::Or' || type === 'BuiltinCommonInstructions::And' || type === 'BuiltinCommonInstructions::Not') {
      checkInstructions(issues, where, instruction.getSubInstructions(), true, scoped);
    }
  }
}

function checkEvents(issues, where, events, scoped) {
  for (let i = 0; i < events.getEventsCount(); i++) {
    const event = events.getEventAt(i);
    if (event.isDisabled()) continue;
    const local = scoped ? gd.ProjectScopedContainers.makeNewProjectScopedContainersWithLocalVariables(scoped, event) : null;
    const label = `${where} › event ${i + 1}`;
    if (event.getType() === 'BuiltinCommonInstructions::Repeat') {
      checkExpression(issues, `${label} repeat count`, local, 'number', gd.asRepeatEvent(event).getRepeatExpression().getPlainString());
    }
    const [conditions, ...actionLists] = eventInstructionLists(event);
    if (conditions) checkInstructions(issues, label, conditions, true, local);
    for (const list of actionLists) checkInstructions(issues, label, list, event.getType() === 'BuiltinCommonInstructions::While' && list === actionLists[0] ? true : false, local);
    if (event.canHaveSubEvents()) checkEvents(issues, label, event.getSubEvents(), local);
  }
}

/** Every problem the project has, as readable lines (empty when the project is sound). */
export function validateProject(project) {
  const issues = [];
  for (let i = 0; i < project.getLayoutsCount(); i++) {
    const layout = project.getLayoutAt(i);
    const scoped = gd.ProjectScopedContainers.makeNewProjectScopedContainersForProjectAndLayout(project, layout);
    checkEvents(issues, `Scene ${layout.getName()}`, layout.getEvents(), scoped);
  }
  for (let i = 0; i < project.getExternalEventsCount(); i++) {
    const external = project.getExternalEventsAt(i);
    const layoutName = external.getAssociatedLayout();
    if (!project.hasLayoutNamed(layoutName)) {
      issues.push(`External events ${external.getName()}: associated scene "${layoutName}" does not exist`);
      continue;
    }
    const scoped = gd.ProjectScopedContainers.makeNewProjectScopedContainersForProjectAndLayout(project, project.getLayout(layoutName));
    checkEvents(issues, `External events ${external.getName()}`, external.getEvents(), scoped);
  }
  for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
    const extension = project.getEventsFunctionsExtensionAt(i);
    if (extension.getAuthor() !== 'HolyHoly') continue;
    const where = `Extension ${extension.getName()}`;
    const functions = (container, prefix) => {
      for (let j = 0; j < container.getEventsFunctionsCount(); j++) {
        const fn = container.getEventsFunctionAt(j);
        checkEvents(issues, `${where} › ${prefix}${fn.getName()}`, fn.getEvents(), null);
      }
    };
    functions(extension.getEventsFunctions(), '');
    const behaviors = extension.getEventsBasedBehaviors();
    for (let j = 0; j < behaviors.getCount(); j++) functions(behaviors.getAt(j).getEventsFunctions(), `${behaviors.getAt(j).getName()}::`);
    const objects = extension.getEventsBasedObjects();
    for (let j = 0; j < objects.getCount(); j++) functions(objects.getAt(j).getEventsFunctions(), `${objects.getAt(j).getName()}::`);
  }
  const resources = project.getResourcesManager();
  const names = resources.getAllResourceNames();
  for (let i = 0; i < names.size(); i++) {
    const resource = resources.getResource(names.at(i));
    if (resource.useFile() && !resource.getFile()) issues.push(`Resource ${names.at(i)} has no file`);
  }
  return issues;
}

/** Issues GDevelop itself found while generating code (undeclared variables, missing behaviors…). */
export function diagnostics(project) {
  const out = [];
  const report = project.getWholeProjectDiagnosticReport();
  for (let i = 0; i < report.count(); i++) {
    const scene = report.get(i);
    for (let j = 0; j < scene.count(); j++) {
      const d = scene.get(j);
      out.push(`Scene ${scene.getSceneName()}: ${d.getMessage()} (object: ${d.getObjectName()}, value: ${d.getActualValue()}, expected: ${d.getExpectedValue()})`);
    }
  }
  return out;
}

/**
 * Exports the game as a static HTML5 site. GDevelop 5.6.269 lists the Draco decoder's .wasm file
 * among the scripts of index.html (fixed in later releases); the browser then reports a syntax
 * error, so that tag is removed. The .wasm file itself stays: the model loader fetches it.
 */
export async function exportGame(project, outDir) {
  await rm(outDir, { recursive: true, force: true });
  exportProject(project, outDir);
  const index = join(outDir, 'index.html');
  const html = await readFile(index, 'utf8');
  await copyFile(join(PROJECT_DIR, 'assets', 'web', 'favicon.png'), join(outDir, 'favicon.png'));
  await writeFile(index, html
    .replace(/\s*<script src="pixi-renderers\/draco\/gltf\/draco_decoder\.wasm[^"]*"[^>]*><\/script>/g, '')
    .replace(/<html[^>]*>/, '<html lang="pl">')
    .replace('</head>', `    <title>${project.getName()}</title>\n    <link rel="icon" type="image/png" href="favicon.png">\n    <meta name="description" content="HolyHolyHoly 3D: anioł stróż rozbija traumy, zamienia je w prawdę i burzy twierdze kłamstw.">\n  </head>`));
  return diagnostics(project);
}

/**
 * Saves the project as a GDevelop "folder project" (one JSON file per scene, external events and
 * extension), the format the editor writes when "Save as several files" is on — readable diffs.
 * The packaged saver replaces each file in place and fails when a file does not exist yet, so a
 * missing file is created empty and the save is retried.
 */
export async function saveGameProject(project, file = PROJECT_FILE) {
  project.setFolderProject(true);
  for (let attempt = 0; attempt < 500; attempt++) {
    try {
      await saveProject(project, file);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT' || !String(error.path).startsWith(PROJECT_DIR)) throw error;
      await mkdir(dirname(error.path), { recursive: true });
      await writeFile(error.path, '{}');
    }
  }
  throw new Error('Could not save the project');
}
