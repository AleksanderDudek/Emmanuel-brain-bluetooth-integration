// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGameProject, validateProject } from '../tools/gdevelop.mjs';
import { PROJECT_DIR, PROJECT_FILE } from '../tools/paths.mjs';

// libGD objects are untyped here: the test reads them through GDevelop's JS bindings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let project: any;

beforeAll(async () => {
  project = await loadGameProject(PROJECT_FILE);
}, 60_000);

describe('the GDevelop project', () => {
  it('is a folder project whose first scene is the title', () => {
    const main = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'));
    expect(main.properties.folderProject).toBe(true);
    expect(project.getFirstLayout()).toBe('Title');
    const scenes = Array.from({ length: project.getLayoutsCount() }, (_, i) => project.getLayoutAt(i).getName());
    expect(scenes).toEqual(['Title', 'Tree', 'Arena', 'Revelation']);
    for (const name of ['title', 'tree', 'arena', 'revelation']) expect(existsSync(join(PROJECT_DIR, 'layouts', `${name}.json`))).toBe(true);
  });

  it('has only valid events: known instructions, right parameters, expressions that resolve', () => {
    expect(validateProject(project)).toEqual([]);
  });

  it('finds every resource file, and the extensions include their JavaScript libraries', () => {
    const resources = project.getResourcesManager();
    const names = resources.getAllResourceNames();
    for (let i = 0; i < names.size(); i++) {
      const file = resources.getResource(names.at(i)).getFile();
      expect(existsSync(join(PROJECT_DIR, file)), file).toBe(true);
    }
    const sources: string[] = [];
    for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
      const files = project.getEventsFunctionsExtensionAt(i).getAllSourceFiles();
      for (let j = 0; j < files.size(); j++) sources.push(files.at(j).getResourceName());
    }
    expect(sources.sort()).toEqual(['lib/mendi-focus.js', 'lib/psalm150.js']);
    for (const s of sources) expect(resources.hasResource(s), s).toBe(true);
  });

  it('keeps the GDevelop splash and watermark (removing them is a GDevelop subscription feature)', () => {
    const main = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'));
    expect(main.properties.loadingScreen.showGDevelopSplash).toBe(true);
    expect(main.properties.watermark.showWatermark).toBe(true);
  });
});
