#!/usr/bin/env node
/**
 * Builds the JavaScript libraries that the GDevelop project includes through its extensions'
 * "source files": project/lib/psalm150.js (soundtrack and effects) and project/lib/mendi-focus.js
 * (Mendi band + focus multiplier). They are bundled from game3d/src, which reuses the 2D game's
 * and the Emmanuel app's TypeScript modules, so both games share one tested implementation.
 *
 *   node game3d/tools/build-libs.mjs           build
 *   node game3d/tools/build-libs.mjs --check   fail if the committed files are out of date
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'rolldown';
import { GAME3D } from './paths.mjs';

const LIBS = [
  { entry: 'src/entries/psalm150.ts', out: 'project/lib/psalm150.js', global: 'Psalm150' },
  { entry: 'src/entries/mendi-focus.ts', out: 'project/lib/mendi-focus.js', global: 'MendiFocus' },
];

const banner = entry =>
  `/* HolyHolyHoly 3D — generated from web/game3d/${entry} by \`npm run game3d:libs\`. Do not edit. License: AGPL-3.0-or-later. */`;

async function bundle({ entry }, dir) {
  const file = join(dir, 'out.js');
  await build({
    input: join(GAME3D, entry),
    platform: 'browser',
    logLevel: 'warn',
    output: { file, format: 'iife', minify: true, comments: false },
  });
  // the minifier drops comments, banners included: the notice is prepended afterwards
  return `${banner(entry)}\n${await readFile(file, 'utf8')}`;
}

const check = process.argv.includes('--check');
const dir = await mkdtemp(join(tmpdir(), 'game3d-libs-'));
let stale = 0;
try {
  for (const lib of LIBS) {
    const code = await bundle(lib, dir);
    const target = join(GAME3D, lib.out);
    if (check) {
      const current = await readFile(target, 'utf8').catch(() => '');
      if (current !== code) {
        stale++;
        console.error(`✗ ${lib.out} is out of date — run npm run game3d:libs`);
      } else console.log(`✓ ${lib.out}`);
    } else {
      await writeFile(target, code);
      console.log(`${lib.out}  ${(code.length / 1024).toFixed(1)} KiB`);
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
if (stale) process.exit(1);
