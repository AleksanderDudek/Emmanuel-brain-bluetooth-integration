// Builders for objects, variables, layers and instances (GDevelop JSON).
import { createHash } from 'node:crypto';
import { defaultObject, defaultBehavior } from './gd.mjs';
import { exampleObject } from './base.mjs';

export const FONT_TEXT = 'assets/fonts/EBGaramond-Medium.ttf';
export const FONT_TITLE = 'assets/fonts/Cinzel-SemiBold.ttf';

export const v = {
  num: (name, value = 0) => ({ name, type: 'number', value }),
  str: (name, value = '') => ({ name, type: 'string', value }),
  bool: (name, value = false) => ({ name, type: 'boolean', value }),
  struct: (name, children) => ({ name, type: 'structure', children }),
  array: (name, children = []) => ({ name, type: 'array', children }),
};

/** Variables every UI object carries, so the UiAll group can use them. */
export const UI_VARS = () => [v.str('Panel'), v.str('Key'), v.str('Action'), v.num('Arg'), v.num('Index'), v.num('MaxH'), v.num('Size'), v.str('FitText')];

const tween = () => defaultBehavior('Tween::TweenBehavior', 'Tween');

export function text(name, { font = FONT_TEXT, size = 26, color = '244;236;216', align = 'left', bold = false, shadow = true, outline = false, outlineColor = '20;14;30', text = '', vars = UI_VARS(), behaviors = [tween()] } = {}) {
  const o = defaultObject('TextObject::Text');
  o.name = name;
  o.string = text;
  o.font = font;
  o.characterSize = size;
  o.textAlignment = align;
  o.bold = bold;
  const [r, g, b] = color.split(';').map(Number);
  o.color = { r, g, b };
  Object.assign(o.content, {
    text, font, characterSize: size, color, textAlignment: align, bold,
    isShadowEnabled: shadow, shadowColor: '0;0;0', shadowOpacity: 160, shadowDistance: 2, shadowBlurRadius: 3, shadowAngle: 90,
    isOutlineEnabled: outline, outlineColor, outlineThickness: 3, verticalTextAlignment: 'top',
  });
  o.variables = vars;
  o.behaviors = behaviors;
  return o;
}

export function panel(name, texture, margin, { vars = UI_VARS(), behaviors = [tween()], tiled = false } = {}) {
  const o = defaultObject('PanelSpriteObject::PanelSprite');
  Object.assign(o, { name, texture, leftMargin: margin, rightMargin: margin, topMargin: margin, bottomMargin: margin, tiled, width: margin * 2 + 8, height: margin * 2 + 8 });
  o.variables = vars;
  o.behaviors = behaviors;
  return o;
}

const point = (name, x, y) => ({ name, x, y });
export function sprite(name, animations, { vars = UI_VARS(), behaviors = [tween()], centered = true, size = 64 } = {}) {
  const o = defaultObject('Sprite');
  o.name = name;
  o.adaptCollisionMaskAutomatically = true;
  // [name, image, size] for a square image, [name, image, width, height] otherwise
  o.animations = animations.map(([animName, image, imageW = size, imageH = imageW]) => ({
    name: animName,
    useMultipleDirections: false,
    directions: [{
      looping: false,
      timeBetweenFrames: 0.08,
      sprites: [{
        hasCustomCollisionMask: false,
        image,
        points: [],
        originPoint: centered ? point('origine', imageW / 2, imageH / 2) : point('origine', 0, 0),
        centerPoint: { automatic: true, name: 'centre', x: 0, y: 0 },
        customCollisionMask: [],
      }],
    }],
  }));
  o.variables = vars;
  o.behaviors = behaviors;
  return o;
}

export function model(name, resource, { w = 100, h = 100, d = 100, anims = [], origin = 'BottomCenterZ', center = 'BottomCenterZ', castShadow = true, receiveShadow = true, keepAspect = true, vars = [], behaviors = [], material = 'StandardWithoutMetalness' } = {}) {
  const o = defaultObject('Scene3D::Model3DObject');
  o.name = name;
  Object.assign(o.content, {
    modelResourceName: resource, width: w, height: h, depth: d, rotationX: 0, rotationY: 0, rotationZ: 0,
    originLocation: origin, centerLocation: center, keepAspectRatio: keepAspect, materialType: material,
    isCastingShadow: castShadow, isReceivingShadow: receiveShadow, crossfadeDuration: 0.1,
    animations: anims.map(([animName, source, loop = true]) => ({ name: animName, source, loop })),
  });
  o.variables = vars;
  o.behaviors = behaviors;
  return o;
}

export function cube(name, { w = 100, h = 100, d = 100, top = '', topRepeat = false, tileScale = 1, tint = '255;255;255', faces = 'top', castShadow = false, receiveShadow = true, vars = [], behaviors = [] } = {}) {
  const o = defaultObject('Scene3D::Cube3DObject');
  o.name = name;
  const only = faces === 'top';
  Object.assign(o.content, {
    width: w, height: h, depth: d, tint, isCastingShadow: castShadow, isReceivingShadow: receiveShadow,
    frontFaceResourceName: top, frontFaceVisible: true, frontFaceResourceRepeat: topRepeat,
    backFaceVisible: !only, leftFaceVisible: !only, rightFaceVisible: !only, topFaceVisible: !only, bottomFaceVisible: !only,
    facesOrientation: 'Y', tileScale,
  });
  o.variables = vars;
  o.behaviors = behaviors;
  return o;
}

/** A ParticleEmitter3D (official extension), based on the example's emitter. */
export function particles(name, image, content, { vars = [] } = {}) {
  const o = exampleObject('DebrisParticle');
  o.name = name;
  delete o.persistentUuid;
  o.content = { ...o.content, ...content };
  const s = o.childrenContent.Particle.animations[0].directions[0].sprites[0];
  s.image = image;
  s.hasCustomCollisionMask = false;
  s.customCollisionMask = [];
  o.variables = vars;
  return o;
}

export function joystick(name) {
  const o = exampleObject('MoveJoystick');
  o.name = name;
  delete o.assetStoreId;
  o.content = { ...o.content, DeadZoneRadius: 0.15, ShouldBeHiddenWhenReleased: true };
  o.childrenContent.Border.animations[0].directions[0].sprites[0].image = 'assets/ui/joystick-border.png';
  o.childrenContent.Thumb.animations[0].directions[0].sprites[0].image = 'assets/ui/joystick-thumb.png';
  return o;
}

export function drawer(name, { vars = UI_VARS() } = {}) {
  const o = defaultObject('PrimitiveDrawing::Drawer');
  o.name = name;
  o.antialiasing = 'medium';
  o.clearBetweenFrames = true;
  o.variables = vars;
  return o;
}

// ─── layers and instances ───────────────────────────────────────────────────────────────────────

const camera = () => [{ defaultSize: true, defaultViewport: true, height: 0, viewportBottom: 1, viewportLeft: 0, viewportRight: 1, viewportTop: 0, width: 0 }];

export function layer(name, { rendering = '', effects = [], fov = 45, far = 10000, near = 3, ambient = [200, 200, 200], visible = true } = {}) {
  return {
    ambientLightColorB: ambient[2], ambientLightColorG: ambient[1], ambientLightColorR: ambient[0],
    camera2DPlaneMaxDrawingDistance: 5000, camera3DFarPlaneDistance: far, camera3DFieldOfView: fov, camera3DNearPlaneDistance: near,
    cameraType: '', followBaseLayerCamera: false, isLightingLayer: false, isLocked: false, name, renderingType: rendering, visibility: visible,
    cameras: camera(), effects,
  };
}

export const effect = (effectType, name, doubles = {}, strings = {}, booleans = {}) =>
  ({ effectType, name, doubleParameters: doubles, stringParameters: strings, booleanParameters: booleans });

/** A stable id per instance (the same project on every build, so the saved files can be compared). */
let instanceCount = 0;
function stableUuid(...parts) {
  const h = createHash('sha1').update(parts.join(':')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function instance(name, x, y, { layer: layerName = '', z, zOrder = 1, w, h, d, angle = 0, vars = [], locked = false } = {}) {
  const i = {
    angle, customSize: w !== undefined, height: h ?? 0, layer: layerName, locked, name, persistentUuid: stableUuid('instance', instanceCount++, name, x, y, layerName),
    width: w ?? 0, x, y, zOrder, numberProperties: [], stringProperties: [],
    initialVariables: vars,
  };
  if (d !== undefined) i.depth = d;
  if (z !== undefined) i.z = z;
  return i;
}
