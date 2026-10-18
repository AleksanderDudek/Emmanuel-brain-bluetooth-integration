#!/usr/bin/env node
/**
 * Checks and exports HolyHolyHoly 3D with GDevelop's own core (no editor needed).
 *
 *   node game3d/tools/export.mjs                 export to web/dist/holyholyholy3d
 *   node game3d/tools/export.mjs --out <dir>     export elsewhere
 *   node game3d/tools/export.mjs --check         only check the project (exports to a temp folder)
 *
 * Fails (exit 1) when an action, condition or expression is unknown or invalid, a resource file is
 * missing, or GDevelop's code generation reports an issue.
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gd, loadGameProject, validateProject, exportGame } from './gdevelop.mjs';
import { EXPORT_DIR, PROJECT_DIR, PROJECT_FILE } from './paths.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : EXPORT_DIR;
if (!out || out.startsWith('--')) {
  console.error('--out needs a directory');
  process.exit(2);
}
// the export replaces the target directory: only an empty one or a previous GDevelop export (gd.js) may be replaced
if (!check && existsSync(out) && readdirSync(out).length && !existsSync(join(out, 'gd.js'))) {
  console.error(`Refusing to replace ${out}: it is not empty and holds no previous export`);
  process.exit(2);
}

const project = await loadGameProject(PROJECT_FILE);
const issues = validateProject(project);

const resources = project.getResourcesManager();
const names = resources.getAllResourceNames();
for (let i = 0; i < names.size(); i++) {
  const file = resources.getResource(names.at(i)).getFile();
  if (file && !existsSync(join(PROJECT_DIR, file))) issues.push(`Resource ${names.at(i)}: file ${file} is missing`);
}

const target = check ? await mkdtemp(join(tmpdir(), 'holyholyholy3d-')) : out;
const diagnostics = await exportGame(project, target);
if (check) await rm(target, { recursive: true, force: true });

const problems = [...issues, ...diagnostics];
const summary = `${project.getName()} (GDevelop ${gd.VersionWrapper.fullString()}): ${project.getLayoutsCount()} scenes, ${project.getEventsFunctionsExtensionsCount()} extensions, ${names.size()} resources`;
if (problems.length) {
  console.error(`✗ ${summary}\n${problems.map(p => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓ ${summary}${check ? ' — project is valid' : ` → ${target}`}`);
