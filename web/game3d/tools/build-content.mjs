#!/usr/bin/env node
/**
 * Builds project/assets/data/content.json (see content.mjs): the 3D story and game data, with what
 * the 2D game shares (Fruits of the Spirit, ranks, the Gdańsk Bible) read from web/game/src/content.
 *
 * The game loads the file into the global variable `Content` when it starts.
 *
 *   node game3d/tools/build-content.mjs           build
 *   node game3d/tools/build-content.mjs --check   fail if the committed file is out of date
 */
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';
import { ASSETS, WEB } from './paths.mjs';
import { makeContent } from './content.mjs';

async function loadContent() {
  const dir = await mkdtemp(join(tmpdir(), 'game3d-content-'));
  try {
    const file = join(dir, 'content.mjs');
    await build({ input: join(WEB, 'game/src/content/index.ts'), platform: 'node', logLevel: 'warn', output: { file, format: 'esm' } });
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

{
  const content = makeContent(await loadContent());
  const json = `${JSON.stringify(content, null, 1)}\n`;
  const target = join(ASSETS, 'data', 'content.json');
  if (process.argv.includes('--check')) {
    const current = await readFile(target, 'utf8').catch(() => '');
    if (current !== json) {
      console.error('✗ project/assets/data/content.json is out of date — run npm run game3d:content');
      process.exit(1);
    }
    console.log('✓ project/assets/data/content.json');
  } else {
    await mkdir(join(ASSETS, 'data'), { recursive: true });
    await writeFile(target, json);
    console.log(`content.json: ${content.chapters.length} chapters, ${content.heroes.length} archangels, ${Object.keys(content.enemies).length} shadow-thoughts, ${content.skillOrder.length} gifts and virtues, ${(json.length / 1024).toFixed(1)} KiB`);
  }
}
