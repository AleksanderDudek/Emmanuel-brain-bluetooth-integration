#!/usr/bin/env node
/**
 * Builds the low-poly 3D models of HolyHolyHoly 3D (project/assets/models/*.glb) from code: the
 * props of the arenas, the spheres of the Ladder, the gifts that fly (shields, flames, the dove,
 * fire from heaven), pickups and the chains of the lies. The figures (archangels, shadows,
 * the lies personified, Christ, the people) are paintings on billboards: see build-billboards.mjs.
 *
 * Models are authored in GDevelop's convention (Z up, facing +X), so their objects keep
 * rotation 0/0/0.
 *
 *   node game3d/tools/build-models.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ASSETS } from './paths.mjs';

// GLTFExporter writes binary glTF through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
};

const OUT = join(ASSETS, 'models');
const TAU = Math.PI * 2;
const deg = d => (d * Math.PI) / 180;

// ─── building blocks ────────────────────────────────────────────────────────────────────────────

function material(name, color, { emissive = 0x000000, glow = 0, roughness = 0.65, metalness = 0, flat = false } = {}) {
  return new THREE.MeshStandardMaterial({ name, color, emissive, emissiveIntensity: glow, roughness, metalness, flatShading: flat });
}

/** A primitive placed in its parent's space: `at` position, `rot` Euler degrees, `scale`. */
function place(geometry, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geometry.clone();
  g.deleteAttribute('uv');
  const indexed = g.index ? g : mergeVertices(g); // polyhedra come unindexed; mergeGeometries needs all alike
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(rot[0]), deg(rot[1]), deg(rot[2]))),
    new THREE.Vector3(...(typeof scale === 'number' ? [scale, scale, scale] : scale)),
  );
  indexed.applyMatrix4(m);
  return indexed;
}

/** One mesh per material: few draw calls per instance, which matters with a crowd of traumas. */
function mesh(name, parts, mat) {
  const m = new THREE.Mesh(mergeGeometries(parts), mat);
  m.name = name;
  return m;
}

function group(name, children = [], at = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...at);
  for (const c of children) g.add(c);
  return g;
}

const sphere = (r = 1, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s).rotateX(Math.PI / 2); // along Z
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s).rotateX(Math.PI / 2); // tip toward +Z
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const torus = (r, t, rs = 8, ts = 24) => new THREE.TorusGeometry(r, t, rs, ts); // in the XY plane (around Z)
const octa = (r = 1) => new THREE.OctahedronGeometry(r, 0);
const dodeca = (r = 1) => new THREE.DodecahedronGeometry(r, 0);
const icosa = (r = 1, d = 0) => new THREE.IcosahedronGeometry(r, d);
const tetra = (r = 1) => new THREE.TetrahedronGeometry(r, 0);

// ─── animation helpers ──────────────────────────────────────────────────────────────────────────

const quat = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(x), deg(y), deg(z))).toArray();

/** Keyframes evenly spaced over `duration`; the last equals the first, so the clip loops. */
function track(type, path, duration, values) {
  const n = values.length;
  const times = values.map((_, i) => (duration * i) / (n - 1));
  if (type === 'quaternion') return new THREE.QuaternionKeyframeTrack(`${path}.quaternion`, times, values.flat());
  return new THREE.VectorKeyframeTrack(`${path}.${type}`, times, values.flat());
}

const wave = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(Math.sin((TAU * i) / n), i / n));

// ─── export ─────────────────────────────────────────────────────────────────────────────────────

async function save(file, root, animations = []) {
  const scene = new THREE.Scene();
  scene.add(root);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations, onlyVisible: false });
  await writeFile(join(OUT, file), Buffer.from(glb));
  return file;
}

// ─── palette ────────────────────────────────────────────────────────────────────────────────────

const M = {
  robe: material('Robe', 0xf4efe6, { roughness: 0.8 }),
  trim: material('Trim', 0xe8c15a, { emissive: 0xe8b54a, glow: 0.35, roughness: 0.4, metalness: 0.3 }),
  skin: material('Skin', 0xf1c8a4, { roughness: 0.7 }),
  hair: material('Hair', 0xf3d27a, { roughness: 0.55 }),
  eyes: material('Eyes', 0x2a2440, { roughness: 0.3 }),
  halo: material('Halo', 0xffe08a, { emissive: 0xffd35c, glow: 1.6, roughness: 0.3 }),
  wing: material('Wing', 0xffffff, { emissive: 0xfff2cf, glow: 0.35, roughness: 0.6 }),
  light: material('Light', 0xfff0b0, { emissive: 0xffd76a, glow: 2.2, roughness: 0.3 }),
  fire: material('Fire', 0xff8a2a, { emissive: 0xff6a1a, glow: 2.0, roughness: 0.5 }),
  fireCore: material('FireCore', 0xffe27a, { emissive: 0xffd04a, glow: 2.4, roughness: 0.5 }),
  stone: material('Stone', 0x8d8a86, { roughness: 0.95, flat: true }),
  marble: material('Marble', 0xe9e3d6, { roughness: 0.7 }),
  wood: material('Wood', 0x7a5536, { roughness: 0.85 }),
  leaf: material('Leaf', 0x6fae5b, { roughness: 0.8, flat: true }),
  wax: material('Wax', 0xf7f0de, { roughness: 0.6 }),
  dove: material('Dove', 0xffffff, { emissive: 0xfff8e8, glow: 0.25, roughness: 0.6 }),
  beak: material('Beak', 0xf0a640, { roughness: 0.6 }),
  bread: material('Bread', 0xf2dca0, { emissive: 0xffe6a0, glow: 0.35, roughness: 0.8 }),
  gold: material('Gold', 0xe6b84a, { emissive: 0xc9952a, glow: 0.3, roughness: 0.35, metalness: 0.4 }),
  fort: material('Fortress', 0x2b2433, { roughness: 0.9, flat: true }),
  crack: material('Crack', 0xff5a2a, { emissive: 0xff4a1a, glow: 2.2, roughness: 0.6 }),
  chain: material('Chain', 0x4a4250, { emissive: 0x6a2020, glow: 0.4, roughness: 0.5, metalness: 0.5, flat: true }),
};

// ─── chains of the lies ─────────────────────────────────────────────────────────────────────────────

function chainPylon() {
  const stone = [place(cyl(0.12, 0.24, 1.3, 4), { at: [0, 0, 0.65], rot: [0, 0, 45] }), place(cone(0.13, 0.25, 4), { at: [0, 0, 1.42], rot: [0, 0, 45] })];
  const links = [0.35, 0.7, 1.05].map((z, i) => place(torus(0.24, 0.045, 6, 14), { at: [0, 0, z], rot: [15 * (i % 2 ? 1 : -1), 0, 30 * i] }));
  const root = group('ChainPylon', [group('Body', [mesh('Stone', stone, M.fort), mesh('Chains', links, M.chain), mesh('Ember', [place(octa(0.06), { at: [0, 0, 1.6] })], M.crack)])]);
  const duration = 2;
  const clip = new THREE.AnimationClip('Idle', duration, [track('quaternion', 'Body', duration, wave(8, (_, t) => quat(0, 0, 360 * t)))]);
  return save('chain-pylon.glb', root, [clip]);
}

/** Glowing eyes looking forward (+X); `mood` tilts them: sad (down at the sides) or angry. */
function eyesAt(x, z, spread, r, mood = 0) {
  return [-1, 1].map(s => place(sphere(r, 10, 8), { at: [x, s * spread, z], rot: [s * mood, 0, 0], scale: [0.5, 1.15, 0.8] }));
}


// ─── projectiles, companions and pickups ───────────────────────────────────────────────────────

const simple = (file, name, parts, mat) => save(file, group(name, [mesh(name, parts, mat)]));

function spinning(file, name, meshes, duration = 2.4, bob = 0.06) {
  const root = group(name, [group('Body', meshes)]);
  const clip = new THREE.AnimationClip('Idle', duration, [
    track('quaternion', 'Body', duration, wave(8, (_, t) => quat(0, 0, 360 * t))),
    track('position', 'Body', duration, wave(8, s => [0, 0, bob * (1 + s)])),
  ]);
  return save(file, root, [clip]);
}

function dove() {
  const body = [
    place(sphere(0.22, 12, 8), { at: [0, 0, 0.3], scale: [1.5, 0.8, 0.8] }),
    place(sphere(0.13, 10, 8), { at: [0.3, 0, 0.42] }),
    place(cone(0.08, 0.25, 6), { at: [-0.38, 0, 0.32], rot: [0, -90, 0], scale: [1, 1.6, 0.5] }),
  ];
  const wing = side => group(`Wing${side > 0 ? 'R' : 'L'}`, [mesh(`Feathers${side}`, [place(sphere(1, 10, 6), { at: [0, side * 0.25, 0], scale: [0.16, 0.28, 0.03] })], M.dove)], [0, side * 0.08, 0.38]);
  const root = group('Dove', [group('Body', [mesh('Plumage', body, M.dove), mesh('Beak', [place(cone(0.04, 0.1, 6), { at: [0.45, 0, 0.42], rot: [0, 90, 0] })], M.beak), mesh('DoveEyes', eyesAt(0.38, 0.47, 0.07, 0.022), M.eyes), wing(-1), wing(1)])]);
  const duration = 0.5;
  const clip = new THREE.AnimationClip('Fly', duration, [
    track('quaternion', 'WingL', duration, wave(6, s => quat(-35 * s, 0, 0))),
    track('quaternion', 'WingR', duration, wave(6, s => quat(35 * s, 0, 0))),
    track('position', 'Body', duration, wave(6, s => [0, 0, 0.03 * s])),
  ]);
  return save('dove.glb', root, [clip]);
}

function flame(file, name, height = 1) {
  const outer = [place(cone(0.26, 0.9 * height, 9), { at: [0, 0, 0.45 * height] }), place(cone(0.14, 0.5 * height, 7), { at: [0.12, 0.08, 0.6 * height] })];
  const inner = [place(cone(0.14, 0.55 * height, 8), { at: [0.02, 0, 0.3 * height] })];
  const root = group(name, [group('Body', [mesh('Outer', outer, M.fire), mesh('Inner', inner, M.fireCore)])]);
  const duration = 0.6;
  const clip = new THREE.AnimationClip('Idle', duration, [
    track('scale', 'Body', duration, wave(6, s => [1 + 0.08 * s, 1 - 0.06 * s, 1 + 0.12 * s])),
    track('quaternion', 'Body', duration, wave(6, (_, t) => quat(0, 0, 120 * t))),
  ]);
  return save(file, root, [clip]);
}

// ─── the world ─────────────────────────────────────────────────────────────────────────────────

function column() {
  const shaft = [place(cyl(0.22, 0.25, 1.6, 12), { at: [0, 0, 1.0] })];
  for (let i = 0; i < 12; i++) {
    const a = (TAU * i) / 12;
    shaft.push(place(box(0.03, 0.03, 1.5), { at: [0.235 * Math.cos(a), 0.235 * Math.sin(a), 1.0] }));
  }
  const caps = [place(box(0.62, 0.62, 0.2), { at: [0, 0, 0.1] }), place(cyl(0.3, 0.3, 0.1, 12), { at: [0, 0, 0.25] }), place(box(0.66, 0.66, 0.16), { at: [0, 0, 1.88] })];
  return save('column.glb', group('Column', [mesh('Shaft', shaft, M.marble), mesh('Caps', caps, M.marble)]));
}

function brokenColumn() {
  const shaft = [place(cyl(0.22, 0.25, 0.7, 12), { at: [0, 0, 0.55] }), place(dodeca(0.16), { at: [0.45, 0.3, 0.12] }), place(dodeca(0.11), { at: [-0.4, 0.35, 0.08] })];
  return save('column-broken.glb', group('BrokenColumn', [mesh('Ruin', shaft, M.marble), mesh('Base', [place(box(0.62, 0.62, 0.2), { at: [0, 0, 0.1] })], M.marble)]));
}

function candle() {
  const root = group('Candle', [
    mesh('Wax', [place(cyl(0.07, 0.08, 0.5, 10), { at: [0, 0, 0.25] }), place(cyl(0.18, 0.2, 0.06, 12), { at: [0, 0, 0.03] })], M.wax),
    mesh('Holder', [place(torus(0.15, 0.025, 6, 16), { at: [0, 0, 0.06] })], M.gold),
    group('Body', [mesh('Flame', [place(cone(0.05, 0.16, 7), { at: [0, 0, 0.6] })], M.fireCore)]),
  ]);
  const duration = 0.8;
  const clip = new THREE.AnimationClip('Idle', duration, [track('scale', 'Body', duration, wave(6, s => [1 + 0.05 * s, 1 + 0.05 * s, 1 + 0.1 * s]))]);
  return save('candle.glb', root, [clip]);
}

function rock() {
  return simple('rock.glb', 'Rock', [place(dodeca(0.5), { at: [0, 0, 0.25], scale: [1.2, 1, 0.6] }), place(dodeca(0.28), { at: [0.45, 0.3, 0.15], scale: [1, 1, 0.7] })], M.stone);
}

function tree() {
  const root = group('Tree', [
    mesh('Trunk', [place(cyl(0.1, 0.16, 1.1, 8), { at: [0, 0, 0.55] }), place(cyl(0.04, 0.07, 0.5, 6), { at: [0.18, 0, 0.95], rot: [0, 45, 0] })], M.wood),
    mesh('Crown', [place(icosa(0.5), { at: [0, 0, 1.35] }), place(icosa(0.36), { at: [0.35, 0.15, 1.15] }), place(icosa(0.32), { at: [-0.3, -0.2, 1.2] })], M.leaf),
  ]);
  return save('tree.glb', root);
}

function pew() {
  return simple('pew.glb', 'Pew', [
    place(box(0.5, 1.6, 0.08), { at: [0, 0, 0.45] }),
    place(box(0.08, 1.6, 0.5), { at: [-0.22, 0, 0.75] }),
    place(box(0.5, 0.08, 0.45), { at: [0, 0.76, 0.22] }),
    place(box(0.5, 0.08, 0.45), { at: [0, -0.76, 0.22] }),
  ], M.wood);
}

function orb(file, name, colour, glow) {
  const core = material(`${name}Core`, colour, { emissive: colour, glow, roughness: 0.3 });
  return spinning(file, name, [mesh('Orb', [place(icosa(0.4, 2), { at: [0, 0, 0.55] })], core), mesh('Ring', [place(torus(0.55, 0.03, 6, 32), { at: [0, 0, 0.55], rot: [70, 0, 0] })], M.gold)], 6, 0.08);
}

function arenaRim() {
  const ring = material('Rim', 0xfff2c8, { emissive: 0xffe2a0, glow: 1.2, roughness: 0.5 });
  const posts = [];
  for (let i = 0; i < 24; i++) {
    const a = (TAU * i) / 24;
    posts.push(place(cone(0.012, 0.06, 5), { at: [Math.cos(a), Math.sin(a), 0.03] }));
  }
  return save('arena-rim.glb', group('ArenaRim', [mesh('Ring', [place(torus(1, 0.006, 4, 96), { at: [0, 0, 0.004] })], ring), mesh('Posts', posts, ring)]));
}

// ─── build ─────────────────────────────────────────────────────────────────────────────────────

await mkdir(OUT, { recursive: true });
const files = await Promise.all([
  chainPylon(),
  save('arrow.glb', group('Arrow', [mesh('Head', [place(cone(0.16, 0.45, 7), { rot: [0, 90, 0], at: [0.3, 0, 0] })], M.fire), mesh('Shaft', [place(cyl(0.05, 0.05, 0.8, 6), { rot: [0, 90, 0], at: [-0.2, 0, 0] })], M.fireCore)])),
  simple('stone.glb', 'Stone', [place(dodeca(0.5))], M.stone),
  save('shield.glb', group('Shield', [mesh('Disc', [place(cyl(0.5, 0.5, 0.08, 18), { rot: [0, 90, 0] })], M.gold), mesh('Cross', [place(box(0.06, 0.1, 0.7), { at: [0.06, 0, 0] }), place(box(0.06, 0.6, 0.1), { at: [0.06, 0, 0.1] })], M.light)])),
  dove(),
  flame('flame.glb', 'Flame', 1),
  flame('fire-pillar.glb', 'FirePillar', 3),
  spinning('light-shard.glb', 'LightShard', [mesh('Gem', [place(octa(0.4), { at: [0, 0, 0.5], scale: [1, 1, 1.5] })], M.light)]),
  spinning('manna.glb', 'Manna', [mesh('Bread', [place(sphere(0.45, 14, 8), { at: [0, 0, 0.35], scale: [1, 1, 0.45] })], M.bread), mesh('Glow', [place(torus(0.5, 0.03, 6, 24), { at: [0, 0, 0.3] })], M.light)], 3, 0.05),
  column(),
  brokenColumn(),
  candle(),
  rock(),
  tree(),
  pew(),
  orb('orb-done.glb', 'OrbDone', 0xffd35c, 1.8),
  orb('orb-open.glb', 'OrbOpen', 0xf4f1ff, 1.4),
  orb('orb-locked.glb', 'OrbLocked', 0x3a3448, 0.2),
  arenaRim(),
]);
console.log(`${files.length} models → ${OUT}`);
