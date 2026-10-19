// The paintings (tools/art.py → project/assets) as the scenes use them: one animation of the
// global UiArt sprite per painting, and the proportions of the billboard models.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from '../tools/billboard.mjs';
import { PROJECT_DIR } from '../tools/paths.mjs';

const MANIFEST = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));
const ASSETS = join(PROJECT_DIR, 'assets');

/** The UiArt animation name of a painting: its file name, prefixed where names would clash. */
function animationName(out) {
  const [dir, file] = out.split('/');
  const base = file.replace(/\.(webp|jpg|png)$/, '');
  return { christ: `christ-${base}`, people: base === 'man' ? 'person-m' : 'person-f', enemies: `enemy-${base}`, bosses: `boss-${base}`, props: base }[dir] ?? base;
}

const sizeOf = file => {
  const path = join(ASSETS, file);
  return existsSync(path) ? imageSize(readFileSync(path)) : null;
};

/** [{ name, file, w, h }] for every painting that exists (textures excluded). */
export function paintings() {
  return MANIFEST.items
    .filter(i => !i.out.startsWith('textures/'))
    .map(i => ({ name: animationName(i.out), file: `assets/${i.out}`, size: sizeOf(i.out) }))
    .filter(p => p.size)
    .map(p => ({ name: p.name, file: p.file, w: p.size.width, h: p.size.height }));
}

/** Height / width of the painting behind a billboard model (1.5 until it is painted). */
export function aspectOf(file) {
  const size = sizeOf(file);
  return size ? size.height / size.width : 1.5;
}

/** The camera looks down at the ground: a standing picture looks this much shorter. */
export const foreshortening = elevationDeg => 1 / Math.cos((elevationDeg * Math.PI) / 180);

/** The painting behind a billboard model (models/<key>.glb). */
export function paintingOf(key) {
  const [, kind, id] = key.match(/^(hero|enemy|boss|christ|person|reliquary)-?(.*)$/) ?? [];
  return { hero: `heroes/${id}.webp`, enemy: `enemies/${id}.webp`, boss: `bosses/${id}.webp`, christ: 'christ/figure.webp', person: id === 'm' ? 'people/man.webp' : 'people/woman.webp', reliquary: 'props/reliquary.webp' }[kind];
}

/** A chapter's painted floor (tools/art.py). */
export function floorTexture(id) {
  if (!existsSync(join(ASSETS, `textures/floor-${id}.jpg`))) throw new Error(`No painted floor textures/floor-${id}.jpg: run tools/art.py`);
  return `assets/textures/floor-${id}.jpg`;
}
