/**
 * Painted characters as "billboards": a vertical quad carrying a cut-out painting, in a GLB the
 * GDevelop Model3D object can load. The quad stands on the ground (Z up, origin at the feet),
 * faces the camera side, is unlit (the painting carries its own light) and alpha-blended. A soft
 * round shadow lies flat under the feet (a second quad, not animated), because a painting cannot
 * cast a real shadow without showing its rectangle.
 *
 * Seen from the game's raised camera a vertical quad looks shorter; scenes compensate with the
 * object's depth (Z size), so one model serves every camera angle. The quad is 1 unit wide and
 * `aspect` units tall; the shadow sets the model's Y extent, which scenes size as the hitbox depth.
 *
 * An "Idle" animation is baked in: a slow bob and breath, so the figures never look frozen.
 *
 * Effects (projectiles, auras, pools) use flatGlb: a quad lying on the ground, seen from above.
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { PNG } from 'pngjs';

/** A soft round shadow: black, opaque in the middle, fading to nothing at the edge (PNG bytes). */
export function blobShadow(size = 64, opacity = 0.55) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      const a = Math.max(0, 1 - d) ** 1.4 * opacity;
      png.data.set([0, 0, 0, Math.round(255 * Math.min(1, a))], (y * size + x) * 4);
    }
  }
  return PNG.sync.write(png);
}

function quad(doc, buffer, name, positions, normals, image, mime) {
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const texture = doc.createTexture(name).setImage(image).setMimeType(mime);
  const material = doc.createMaterial(name)
    .setBaseColorTexture(texture)
    .setAlphaMode('BLEND')
    .setDoubleSided(true)
    .setMetallicFactor(0)
    .setRoughnessFactor(1)
    .setExtension('KHR_materials_unlit', doc.getRoot().listExtensionsUsed().find(e => e.extensionName === 'KHR_materials_unlit').createUnlit());
  const primitive = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer))
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(primitive);
}

function newDocument(mime) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  if (mime === 'image/webp') doc.createExtension(EXTTextureWebP).setRequired(true);
  doc.createExtension(KHRMaterialsUnlit);
  return { doc, buffer };
}

const write = doc => new NodeIO().registerExtensions([EXTTextureWebP, KHRMaterialsUnlit]).writeBinary(doc);

/**
 * @param {object} o
 * @param {Uint8Array} o.image   PNG or WebP bytes (with alpha)
 * @param {string} o.mime        'image/webp' | 'image/png'
 * @param {number} o.aspect      height / width of the painting
 * @param {number} [o.bob]       bob height, fraction of the quad height
 * @param {number} [o.period]    seconds per breath
 * @param {number} [o.sway]      roll in degrees (a slight lean left and right)
 * @param {{width: number, depth: number}} [o.shadow]  the shadow's size, in units of the quad width
 */
export async function billboardGlb({ image, mime, aspect, bob = 0.025, period = 2.4, sway = 1.5, shadow = { width: 0.72, depth: 0.32 } }) {
  const { doc, buffer } = newDocument(mime);
  const w = 1;
  const h = aspect;
  // facing -Y in model space: GDevelop flips Y, so the face looks toward +Y, the camera side
  const painting = quad(doc, buffer, 'Painting', [-w / 2, 0, 0, w / 2, 0, 0, w / 2, 0, h, -w / 2, 0, h], [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], image, mime);
  const body = doc.createNode('Body').setMesh(painting);
  const root = doc.createNode('Billboard').addChild(body);
  const sw = shadow.width / 2, sd = shadow.depth / 2, z = 0.004;
  const shade = quad(doc, buffer, 'Shadow', [-sw, -sd, z, sw, -sd, z, sw, sd, z, -sw, sd, z], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], blobShadow(), 'image/png');
  root.addChild(doc.createNode('Shadow').setMesh(shade));
  doc.createScene('Scene').addChild(root);

  // Idle: bob up and down, breathe a little, lean slightly — a loop of `period` seconds
  const steps = 16;
  const times = new Float32Array(steps + 1);
  const translation = new Float32Array((steps + 1) * 3);
  const scale = new Float32Array((steps + 1) * 3);
  const rotation = new Float32Array((steps + 1) * 4);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(t * Math.PI * 2);
    const c = Math.cos(t * Math.PI * 2);
    times[i] = t * period;
    translation.set([0, 0, bob * h * (0.5 + 0.5 * s)], i * 3);
    scale.set([1 - 0.012 * s, 1, 1 + 0.018 * s], i * 3);
    const roll = ((sway * c) * Math.PI) / 180 / 2; // about the view axis (Y)
    rotation.set([0, Math.sin(roll), 0, Math.cos(roll)], i * 4);
  }
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  const animation = doc.createAnimation('Idle');
  for (const [path, type, values] of [['translation', 'VEC3', translation], ['scale', 'VEC3', scale], ['rotation', 'VEC4', rotation]]) {
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType(type).setArray(values).setBuffer(buffer)).setInterpolation('LINEAR');
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(body).setTargetPath(path).setSampler(sampler));
  }
  return write(doc);
}

/**
 * A quad lying on the ground (XY plane, facing +Z), centred on the origin: 1 unit long along X and
 * `aspect` units wide along Y. For projectiles (pointing +X, so the object's angle aims them),
 * auras and pools. `spin` bakes a slow turn (degrees per second) into an "Idle" animation.
 */
export async function flatGlb({ image, mime = 'image/png', aspect = 1, spin = 0 }) {
  const { doc, buffer } = newDocument(mime);
  const w = 0.5, h = aspect / 2;
  const mesh = quad(doc, buffer, 'Effect', [-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], image, mime);
  const body = doc.createNode('Body').setMesh(mesh);
  doc.createScene('Scene').addChild(doc.createNode('Flat').addChild(body));
  if (spin) {
    const period = 360 / Math.abs(spin);
    const steps = 8;
    const times = new Float32Array(steps + 1);
    const rotation = new Float32Array((steps + 1) * 4);
    for (let i = 0; i <= steps; i++) {
      const a = (Math.sign(spin) * (i / steps) * Math.PI * 2) / 2;
      times[i] = (i / steps) * period;
      rotation.set([0, 0, Math.sin(a), Math.cos(a)], i * 4);
    }
    const sampler = doc.createAnimationSampler()
      .setInput(doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer))
      .setOutput(doc.createAccessor().setType('VEC4').setArray(rotation).setBuffer(buffer))
      .setInterpolation('LINEAR');
    doc.createAnimation('Idle').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(body).setTargetPath('rotation').setSampler(sampler));
  }
  return write(doc);
}

/** Width and height of a WebP or PNG file (from its header). */
export function imageSize(bytes) {
  const b = Buffer.from(bytes);
  if (b.toString('ascii', 1, 4) === 'PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a PNG or WebP image');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`unknown WebP chunk ${chunk}`);
}
