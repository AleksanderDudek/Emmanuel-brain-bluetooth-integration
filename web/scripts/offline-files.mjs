#!/usr/bin/env node
/**
 * The packs the app can download for offline use (src/ui/offline.ts, DESIGN.md §16), written at the end of the
 * build as dist/offline-files.json: the 3D game (dist/holyholyholy3d), the 2D game (dist/holyholyholy) and the
 * exercise cards' images (dist/cards) — every file with its size, paths relative to the app's base.  Source maps
 * stay out (nobody plays them).  Each game's folder also gets its directory URL ("holyholyholy3d/"), the address
 * the app's iframe opens, so the cached page answers it.
 *
 *   node scripts/offline-files.mjs [dist]
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? join(import.meta.dirname, '..', 'dist');
const PACKS = [
  { id: 'game3d', dir: 'holyholyholy3d', page: true },
  { id: 'game2d', dir: 'holyholyholy', page: true },
  { id: 'cards', dir: 'cards', page: false },
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.isFile() && !e.name.endsWith('.map')) out.push(p);
  }
  return out;
}

const hash = createHash('sha256');
const packs = [];
for (const pk of PACKS) {
  const root = join(dist, pk.dir);
  let files;
  try {
    files = (await walk(root)).sort();
  } catch {
    console.warn(`offline-files: ${pk.dir} missing — pack left out`);
    continue;
  }
  let bytes = 0;
  const paths = [];
  for (const f of files) {
    const s = await stat(f);
    bytes += s.size;
    const rel = relative(dist, f).split(sep).join('/');
    paths.push(rel);
    hash.update(rel);
    hash.update(await readFile(f));
  }
  if (pk.page) paths.unshift(`${pk.dir}/`);
  packs.push({ id: pk.id, bytes, files: paths });
}
const manifest = { version: hash.digest('hex').slice(0, 16), packs };
await writeFile(join(dist, 'offline-files.json'), JSON.stringify(manifest));
console.log(`offline-files: ${packs.map(p => `${p.id} ${p.files.length} files ${(p.bytes / 1e6).toFixed(1)} MB`).join(' · ')}`);
