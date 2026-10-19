// Project-level pieces: properties, resources, official extensions, global variables.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { defaultProjectJson } from './gd.mjs';
import { PROJECT_DIR } from '../tools/paths.mjs';

export { PROJECT_DIR };
const VENDOR = new URL('./vendor/', import.meta.url);
/** Official extensions from GDevelop's extension store (MIT), as published with GDevelop 5.6. */
const EXTENSIONS = JSON.parse(readFileSync(new URL('extensions.json', VENDOR), 'utf8'));
/** Object and behavior templates of those extensions (joystick, particle emitter, FireBullet…). */
const TEMPLATES = JSON.parse(readFileSync(new URL('templates.json', VENDOR), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const KIND = { '.glb': 'model3D', '.png': 'image', '.webp': 'image', '.jpg': 'image', '.ttf': 'font', '.json': 'json', '.js': 'javascript' };

export function resources() {
  const files = [...walk(join(PROJECT_DIR, 'assets')), ...walk(join(PROJECT_DIR, 'lib'))]
    .filter(f => KIND[extname(f)] && !f.includes('/assets/web/'))
    .map(f => relative(PROJECT_DIR, f))
    .sort();
  return files.map(file => {
    const kind = KIND[extname(file)];
    const r = { file, kind, metadata: '', name: file, userAdded: true };
    if (kind === 'image') r.smoothed = true;
    if (kind === 'json') r.disablePreload = false;
    return r;
  });
}

/** Official extensions, as published in GDevelop's extension store (taken from the 3D survivor example). */
export function officialExtensions(names) {
  return names.map(n => {
    if (!EXTENSIONS[n]) throw new Error('No extension ' + n);
    return structuredClone(EXTENSIONS[n]);
  });
}

export function exampleObject(name) {
  if (!TEMPLATES[name]) throw new Error('No template ' + name);
  return structuredClone(TEMPLATES[name]);
}

export function projectBase() {
  const p = defaultProjectJson();
  Object.assign(p.properties, {
    name: 'HolyHolyHoly 3D',
    author: 'HolyHolyHoly',
    description: 'Anioł stróż w trzech wymiarach rozbija traumy człowieka, zamienia je w prawdę i burzy twierdze kłamstw. Archero × survivors × Endless Puncher, muzyka „Psalm 150”, opcjonalnie opaska fNIRS Mendi.',
    packageName: 'pl.holyholyholy.game3d',
    version: '1.0.0',
    windowWidth: 1280,
    windowHeight: 720,
    orientation: 'landscape',
    sizeOnStartupMode: 'adaptWidth',
    adaptGameResolutionAtRuntime: true,
    antialiasingMode: 'MSAA',
    antialisingEnabledOnMobile: false,
    pixelsRounding: false,
    scaleMode: 'linear',
    maxFPS: 60,
    minFPS: 20,
    verticalSync: false,
    folderProject: true,
    playableDevices: ['keyboard', 'mobile'],
    categories: ['action', 'adventure'],
  });
  Object.assign(p.properties.loadingScreen, {
    backgroundColor: 0x07080f,
    gdevelopLogoStyle: 'light',
    progressBarColor: 0xe8c15a,
    showGDevelopSplash: true,
    showProgressBar: true,
    minDuration: 1.5,
  });
  p.properties.watermark = { placement: 'bottom-left', showWatermark: true };
  return p;
}
