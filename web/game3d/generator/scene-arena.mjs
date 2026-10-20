// Arena: one chapter of the person's story, in three stages of one day or night (a clock runs,
// the light changes, each stage has its own shadows and modifier). Shadow-thoughts come in hordes
// (survivors), the archangel's own gift acts while the angel stands still (Archero), strikes go in
// combos (Endless Puncher), gifts and virtues come at each level with evolutions and reliquaries
// (Heroes vs Hordes). Voices (speaking shadows) say the person's thoughts aloud; silenced, they
// show how the thought lies and what is true instead. Memories on the map tell the story. Springs,
// words of truth and a breath heal. Between stages a recognition card shows a thought, its
// thinking error and the answer; at the end the chapter's lie comes in its own figure.
import { A, C, NOT, OR, AND, ev, group, comment, q, set, setS, setB, is, isS, isB, cmp, cmpS, oisS, ois, oisB, oset, osetS, osetB, text, keyJust, key, link, begins, scene, animE, anim, forEach, repeat, setZ, width, size, tint, opacity, scale, tweenOpacity, tweenPos, tweenWidth, dt } from './dsl.mjs';
import { model, cube, particles, joystick, sprite, layer, effect, instance, v } from './objects.mjs';
import { defaultBehavior } from './gd.mjs';
import { exampleObject } from './base.mjs';
import { button, label, box, closePanel, sfx, clicked, settingsPanel, settingsEvents, SAVE_KEY, TUNING, HERO_IDS, CHAPTER_IDS, SKILL_IDS } from './ui.mjs';
import { applyQuality, bootEvents } from './scene-title.mjs';
import { aspectOf, foreshortening, paintingOf, floorTexture } from './art.mjs';
import { ENEMIES } from '../tools/game-data.mjs';

const KINDS = ENEMIES.map(e => e.kind);
const BIG = new Set(ENEMIES.filter(e => e.archetype === 'tank').map(e => e.kind));
const R = 'Tuning.arenaRadius';
const ST = 'Content.chapters[Chapter].stages[Stage - 1]';
const PX = 'Player.X()', PY = 'Player.Y()';
// skill ids may hold a hyphen (sig-uriel): always reach them with brackets
const G = id => `Run.gifts["${id}"]`;
const evo = id => isB(`Run.evo["${id}"]`, true);
const noEvo = id => isB(`Run.evo["${id}"]`, false);
const hero = id => isS('Run.hero', '=', q(id));
const HERO = 'Content.heroes[Content.heroIndex[Run.hero]]';
const CH = 'Content.chapters[Chapter]';
const SIG = 'Run.gifts[SigId]';
const step = (x, from) => `clamp(${x} - ${from - 1}, 0, 1)`; // 1 when x >= from
const store = () => A('HolyHoly::StoreSave', q('Save'), q(SAVE_KEY));
const tween = () => defaultBehavior('Tween::TweenBehavior', 'Tween');
const playing = () => isS('State', '=', q('play'));
const banner = (expr, secs = 2.4) => [setS('BannerText', '=', expr), set('BannerT', '=', String(secs))];
const shake = s => set('Shake', '=', `max(Shake, ${s})`);
const particle = (name, x, y, z = '40') => [A('Create', name, x, y, '""'), setZ(name, z)];
const ARENA_ELEVATION = 48; // camera: CamTilt 42° from straight down
const FLOOR = 7000;
const FS = foreshortening(ARENA_ELEVATION);

/** Variables every target (shadows, the lie personified, its chains) carries, so the Targets group can use them. */
const targetVars = () => [
  v.num('Hp'), v.num('MaxHp'), v.num('Stun'), v.num('KnockT'), v.num('KnockA'), v.num('KnockS'), v.num('HitCD'), v.num('ShieldCD'),
  v.num('Armor', 1), v.num('PunchMul', 1), v.num('T'), v.bool('Dying'), v.str('Kind'), v.num('BurnT'), v.num('BurnDps'), v.num('HitT'), v.num('BaseScale', 1),
];
const traumaVars = () => [
  ...targetVars(), v.num('Speed'), v.num('SpeedNow'), v.num('Slow'), v.num('SlowT'), v.str('Archetype'), v.str('State', 'walk'), v.num('Value', 1), v.bool('Elite'), v.bool('Small'),
  v.num('Dir', 1), v.num('ChargeA'), v.num('FireCD', 2), v.num('Uid'), v.bool('Voice'),
];
const shotVars = () => [v.num('Damage'), v.num('Pierce'), v.num('Grace'), v.num('Life', 2), v.num('Burn')];

function fireBullet(name, cooldown, quantity = 1, arc = 0) {
  const b = structuredClone(exampleObject('Player').behaviors.find(x => x.type === 'FireBullet::FireBullet'));
  Object.assign(b, { name, FireCooldown: cooldown, BulletQuantity: quantity, FiringArc: arc, RotateBullet: true, UnlimitedAmmo: true, AngleVariance: 0, BulletSpeedVariance: 0, isFolded: true });
  return b;
}

function topDown() {
  const b = structuredClone(exampleObject('Player').behaviors.find(x => x.type === 'TopDownMovementBehavior::TopDownMovementBehavior'));
  Object.assign(b, { maxSpeed: TUNING.playerSpeed, acceleration: 2600, deceleration: 3200, rotateObject: false, angularMaxSpeed: 900 });
  return b;
}

const mapper = () => structuredClone(exampleObject('Player').behaviors.find(x => x.type === 'SpriteMultitouchJoystick::TopDownMultitouchMapper'));

function touchButton(name, image, id) {
  const o = sprite(name, [['Idle', image, 192]], { vars: [], behaviors: [] });
  o.behaviors = [{ name: 'MultitouchButton', type: 'SpriteMultitouchJoystick::MultitouchButton', ControllerIdentifier: 1, ButtonIdentifier: id, TouchRadius: 0 }];
  return o;
}

/** A painted figure standing on the ground (models/<key>.glb): width w, hitbox depth h, height from its painting. */
export const billboard = (name, key, w, h, { elevation = ARENA_ELEVATION, vars = [], behaviors = [tween()] } = {}) =>
  model(name, `assets/models/${key}.glb`, { w, h, d: Math.round(w * aspectOf(paintingOf(key)) * foreshortening(elevation)), keepAspect: false, castShadow: false, receiveShadow: false, anims: [['Idle', 'Idle']], vars, behaviors });

/** A glowing quad lying on the ground (projectiles, auras, pools): centred, it turns with its angle. */
const flat = (name, file, w, h, vars = [], anims = []) =>
  model(name, file, { w, h, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter', vars, anims, behaviors: [tween()] });

export function arenaScene() {
  const props = [
    model('Column', 'assets/models/column.glb', { w: 130, h: 130, d: 260 }),
    model('ColumnBroken', 'assets/models/column-broken.glb', { w: 150, h: 135, d: 135 }),
    model('Candle', 'assets/models/candle.glb', { w: 36, h: 36, d: 64, anims: [['Idle', 'Idle']], castShadow: false }),
    model('Rock', 'assets/models/rock.glb', { w: 160, h: 135, d: 85 }),
    model('Tree', 'assets/models/tree.glb', { w: 190, h: 190, d: 240 }),
    model('Pew', 'assets/models/pew.glb', { w: 72, h: 200, d: 84 }),
  ];
  const burst = (name, image, content) => particles(name, image, { Duration: 0.08, ShouldAutodestruct: true, Blending: 'Additive', SpayConeAngle: 360, ...content });
  const heroes = HERO_IDS.map(id => billboard(`Hero_${id}`, `hero-${id}`, 150, 60));
  const enemies = KINDS.map(k => billboard(`Enemy_${k}`, `enemy-${k}`, BIG.has(k) ? 128 : 96, BIG.has(k) ? 66 : 50, { vars: traumaVars() }));
  // the lie of the chapter, personified: a towering figure, three times a shadow's height
  const bosses = CHAPTER_IDS.map(id => billboard(`Boss_${id}`, `boss-${id}`, 270, 100));
  const memories = ['m', 'f'].map(g => billboard(`Memory_${g}`, `person-${g}`, 96, 40, { vars: [v.num('Index'), v.num('Stage'), v.num('Uid')] }));
  const shots = [
    flat('Bolt', 'assets/models/fx-flame.glb', 72, 36, shotVars()),
    flat('Spear', 'assets/models/fx-spear.glb', 170, 27, shotVars()),
    flat('Orb', 'assets/models/fx-orb.glb', 70, 70, shotVars()),
    flat('Vial', 'assets/models/fx-vial.glb', 42, 42, shotVars()),
    flat('Lash', 'assets/models/fx-lash.glb', 150, 38, shotVars()),
    flat('Petal', 'assets/models/fx-petal.glb', 40, 30, shotVars()),
    model('Stone', 'assets/models/stone.glb', { w: 26, h: 26, d: 26, origin: 'ObjectCenter', center: 'ObjectCenter', vars: shotVars() }),
  ];
  const objects = [
    cube('Floor', { w: FLOOR, h: FLOOR, d: 10, top: floorTexture('noc'), topRepeat: true, tileScale: 0.3 }),
    model('Rim', 'assets/models/arena-rim.glb', { w: 6400, h: 6400, d: 40, keepAspect: false, castShadow: false, receiveShadow: false }),
    ...props,
    // the angel's footprint: a soft light that carries the movement and the gifts; the painting follows it
    model('Player', 'assets/models/fx-glow.glb', { w: 112, h: 112, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, anims: [['Idle', 'Idle']],
      behaviors: [topDown(), mapper(), fireBullet('ShotGun', TUNING.shotCooldown), fireBullet('SlingGun', 3), tween()] }),
    ...heroes,
    ...enemies,
    // the lie's body: invisible, it carries movement and strength; its painting follows it
    model('Liar', 'assets/models/fx-glow.glb', { w: 260, h: 130, d: 2, keepAspect: false, castShadow: false, receiveShadow: false, vars: [...targetVars(), v.num('Phase', 1)], behaviors: [tween()] }),
    ...bosses,
    model('ChainPylon', 'assets/models/chain-pylon.glb', { w: 80, h: 80, d: 140, anims: [['Idle', 'Idle']], vars: targetVars(), behaviors: [tween()] }),
    ...shots,
    flat('Pool', 'assets/models/fx-pool.glb', 240, 240, [v.num('T'), v.num('Life', 3), v.num('Radius', 120), v.num('Tick')], [['Idle', 'Idle']]),
    flat('Aura', 'assets/models/fx-incense.glb', 300, 300, [], [['Idle', 'Idle']]),
    flat('Glow', 'assets/models/fx-glow.glb', 90, 90, [v.num('T')], [['Idle', 'Idle']]),
    model('Arrow', 'assets/models/arrow.glb', { w: 56, h: 20, d: 20, keepAspect: false, castShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter' }),
    model('Shield', 'assets/models/shield.glb', { w: 50, h: 50, d: 50, castShadow: false, origin: 'ObjectCenter', center: 'ObjectCenter', vars: [v.num('Index')] }),
    model('FlameRing', 'assets/models/flame.glb', { w: 40, h: 40, d: 62, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Index')] }),
    model('Dove', 'assets/models/dove.glb', { w: 64, h: 64, d: 40, anims: [['Fly', 'Fly']], vars: [v.str('State', 'orbit'), v.num('T'), v.num('TX'), v.num('TY')] }),
    model('FirePillar', 'assets/models/fire-pillar.glb', { w: 110, h: 110, d: 300, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('T'), v.bool('Hit'), v.num('Radius', 110), v.num('Damage', 50)], behaviors: [tween()] }),
    model('Shockwave', 'assets/models/arena-rim.glb', { w: 20, h: 20, d: 20, keepAspect: false, castShadow: false, receiveShadow: false, vars: [v.num('T'), v.num('Radius', 300), v.num('Life', 0.35)] }),
    model('LightShard', 'assets/models/light-shard.glb', { w: 30, h: 30, d: 44, anims: [['Idle', 'Idle']], castShadow: false, vars: [v.num('Value', 1), v.bool('Pull')], behaviors: [tween()] }),
    model('Manna', 'assets/models/manna.glb', { w: 54, h: 54, d: 30, anims: [['Idle', 'Idle']], castShadow: false }),
    billboard('Reliquary', 'reliquary', 70, 40),
    flat('Spring', 'assets/models/fx-spring.glb', TUNING.springRadius * 2, TUNING.springRadius * 2, [v.num('Water', TUNING.springWater), v.num('Tick'), v.num('Dry')], [['Idle', 'Idle']]),
    flat('Truth', 'assets/models/fx-truth.glb', 76, 76, [v.num('T')], [['Idle', 'Idle']]),
    flat('VoiceRing', 'assets/models/fx-voice.glb', 230, 230, [v.num('Uid')], [['Idle', 'Idle']]),
    flat('MemoryLight', 'assets/models/fx-memory.glb', 260, 260, [v.num('Uid')], [['Idle', 'Idle']]),
    ...memories,
    burst('BurstShadow', 'assets/particles/soft.png', { StartColor: '90;60;140', EndColor: '255;236;180', StartOpacity: 230, EndOpacity: 0, Flow: 900, StartSizeMin: 16, StartSizeMax: 34, EndScale: 0.2, StartSpeedMin: 120, StartSpeedMax: 320, LifespanMin: 0.25, LifespanMax: 0.6, Gravity: -120 }),
    burst('BurstLight', 'assets/particles/spark.png', { StartColor: '255;236;160', EndColor: '255;255;255', StartOpacity: 255, EndOpacity: 0, Flow: 1200, StartSizeMin: 14, StartSizeMax: 30, EndScale: 0.2, StartSpeedMin: 200, StartSpeedMax: 520, LifespanMin: 0.3, LifespanMax: 0.8, Gravity: 200 }),
    burst('BurstFire', 'assets/particles/soft.png', { StartColor: '255;170;60', EndColor: '255;80;20', StartOpacity: 255, EndOpacity: 0, Flow: 1600, StartSizeMin: 20, StartSizeMax: 44, EndScale: 0.3, StartSpeedMin: 260, StartSpeedMax: 620, LifespanMin: 0.25, LifespanMax: 0.6, Gravity: -200 }),
    burst('BurstHeal', 'assets/particles/soft.png', { StartColor: '140;255;170', EndColor: '255;255;230', StartOpacity: 220, EndOpacity: 0, Flow: 700, StartSizeMin: 12, StartSizeMax: 26, EndScale: 0.2, StartSpeedMin: 60, StartSpeedMax: 220, LifespanMin: 0.4, LifespanMax: 0.9, Gravity: -160 }),
    burst('HitSpark', 'assets/particles/spark.png', { StartColor: '255;250;220', EndColor: '255;220;120', StartOpacity: 255, EndOpacity: 0, Flow: 600, StartSizeMin: 10, StartSizeMax: 20, EndScale: 0.2, StartSpeedMin: 140, StartSpeedMax: 300, LifespanMin: 0.12, LifespanMax: 0.3, Gravity: 0 }),
    particles('Motes', 'assets/particles/soft.png', { StartColor: '255;236;180', EndColor: '255;255;240', StartOpacity: 160, EndOpacity: 0, Flow: 30, StartSizeMin: 6, StartSizeMax: 14, EndScale: 0.3, StartSpeedMin: 8, StartSpeedMax: 30, LifespanMin: 4, LifespanMax: 8, Duration: -1, SpayConeAngle: 360, Gravity: -8, Blending: 'Additive', ShouldAutodestruct: false }),
    joystick('Joystick'),
    touchButton('TouchStrike', 'assets/ui/touch-strike.png', 'A'),
    touchButton('TouchPrayer', 'assets/ui/touch-fire.png', 'B'),
    touchButton('TouchBreath', 'assets/ui/touch-breath.png', 'C'),
  ];
  const instances = [
    instance('Floor', -FLOOR / 2, -FLOOR / 2, { z: -10, w: FLOOR, h: FLOOR, d: 10, locked: true }),
    instance('Rim', 0, 0, { w: 6400, h: 6400, d: 40, locked: true }),
    instance('Player', 0, 0, { z: 3, w: 112, h: 112, d: 2 }),
    instance('Motes', 0, 0, { z: 30 }),
    instance('Joystick', 200, 560, { layer: 'Touch' }),
    instance('TouchStrike', 1100, 560, { layer: 'Touch' }),
    instance('TouchPrayer', 1100, 380, { layer: 'Touch' }),
    instance('TouchBreath', 1100, 380, { layer: 'Touch' }),
  ];

  const events = [
    link('UI'),
    bootEvents(),
    setupEvents(),
    introEvents(),
    statsEvents(),
    movementEvents(),
    prayerEvents(),
    signatureEvents(),
    strikeEvents(),
    giftEvents(),
    traumaEvents(),
    pickupEvents(),
    levelUpEvents(),
    stageEvents(),
    voiceEvents(),
    memoryEvents(),
    healingEvents(),
    recognitionEvents(),
    liarEvents(),
    hurtEvents(),
    pauseEvents(),
    feedbackEvents(),
    hudEvents(),
  ];
  const stats = ['dmgMul', 'shotDamage', 'shotCooldown', 'shotPierce', 'shotSpeed', 'shotCount', 'shotArc', 'shotRange', 'shotSize', 'shotLife', 'burn',
    'speed', 'magnet', 'dodge', 'lightMul', 'prayerMul', 'comboWindow', 'grace', 'punchDamage', 'punchReach', 'punchCooldown', 'hpMul',
    'aura', 'auraDps', 'auraSlow', 'poolR', 'poolDps', 'poolHeal', 'poolLife', 'poolSlow',
    'tarczaN', 'tarczaDmg', 'tarczaR', 'ogienR', 'ogienTick', 'ogienDmg', 'wicherT', 'wicherR', 'wicherDmg', 'doveCd', 'doveDmg',
    'eliaszT', 'eliaszN', 'eliaszR', 'eliaszDmg', 'jerT', 'jerStun', 'jerDmg', 'slingCd', 'slingDmg', 'slingPierce'];
  return {
    name: 'Arena',
    background: [20, 16, 26],
    layers: [
      layer('', {
        far: 9000,
        effects: [
          effect('Scene3D::HemisphereLight', 'Sky', { elevation: 60, intensity: 0.62, rotation: 300 }, { groundColor: '70;60;80', skyColor: '255;246;230', top: 'Z+' }),
          effect('Scene3D::DirectionalLight', 'Sun', { distanceFromCamera: 2200, elevation: 58, frustumSize: 3800, intensity: 0.85, minimumShadowBias: 0, rotation: 320, shadowDistance: 3400 }, { color: '255;240;214', shadowQuality: 'medium', shadowRenderingMode: 'fittedToCameraView', top: 'Z+' }, { isCastingShadow: true }),
          effect('Scene3D::LinearFog', 'Fog', { near: 2300, far: 5400 }, { color: '30;24;40' }),
          effect('Scene3D::Bloom', 'Glow', { strength: 0.55, radius: 0.35, threshold: 0.86 }),
        ],
      }),
      layer('Touch', { rendering: '2d' }),
      layer('UI', { rendering: '2d' }),
    ],
    objects,
    instances,
    events,
    variables: [
      v.str('State', 'intro'), v.str('PrevState'), v.num('StateT'), v.num('Chapter'), v.str('ChapterId'), v.num('KindCount'), v.str('SigId'),
      v.num('Stage', 1), v.num('StageCount', 3), v.num('StageTime'), v.bool('StageBegin'), v.num('SpawnT', 1.5), v.bool('EliteSpawned'), v.num('NextUid', 1),
      v.num('SpawnMul', 1), v.num('HpMul', 1), v.num('VoiceMul', 1), v.num('VoiceT', 12), v.num('VoiceNext'), v.num('SilT', -1), v.num('CardT', -1), v.num('MemoryT', -1),
      v.num('BreathT'), v.num('BreathCD'), v.bool('SpringSeen'), v.bool('VoiceAlive'), v.bool('CardNow'), v.bool('Recognized'),
      v.num('Still'), v.num('Prayer'), v.bool('PrayerFull'), v.num('Hearts', 5), v.num('MaxHearts', 5), v.num('Invuln'), v.bool('HelmUsed'), v.num('Regen'), v.num('RegenT'),
      v.num('Xp'), v.num('XpNext', TUNING.xpFirst), v.num('Level', 1), v.num('LevelT'), v.bool('LevelBuild'), v.num('Rerolls', 1), v.num('RelicT'),
      v.num('Combo'), v.num('ComboT'), v.num('StrikeCD'), v.num('DashT'), v.num('DashA'), v.num('Chain'), v.num('ChainT'), v.num('SeedT'), v.num('AffT'),
      v.num('AuraP'), v.num('AuraT'), v.num('CrownT'), v.num('Heavy'),
      v.num('Shake'), v.str('BannerText'), v.num('BannerT'), v.num('FlashT'), v.num('MissT'), v.num('PraiseT'),
      v.bool('StatsDirty', true), v.bool('HudDirty', true), v.bool('HurtNow'), v.bool('StrikeNow'), v.bool('UltNow'), v.bool('Hit'),
      v.struct('St', stats.map(k => v.num(k, 1))),
      v.struct('Tm', ['shieldAngle', 'ogien', 'wicher', 'golebica', 'eliasz', 'jerycho', 'music'].map(k => v.num(k, 1))),
      v.num('DashBoss'), v.num('BossArrowT', 3), v.num('BossSummonT', 5), v.num('BossDashT', 4), v.num('BossSpin'), v.num('Best'), v.num('BestX'), v.num('BestY'),
      v.num('CamZ', TUNING.camZ), v.num('CamTilt', 90 - ARENA_ELEVATION), v.num('CamLead', 150), v.array('Props'), v.num('VoiceLineT'),
    ],
    folders: {
      'Świat': ['Floor', 'Rim', 'Motes'],
      'Rekwizyty': props.map(p => p.name),
      'Anioł': ['Player', ...heroes.map(h => h.name)],
      'Cienie-myśli': enemies.map(e => e.name),
      'Kłamstwo rozdziału': ['Liar', ...bosses.map(b => b.name), 'ChainPylon'],
      'Historia i leczenie': ['Spring', 'Truth', 'VoiceRing', 'MemoryLight', ...memories.map(m => m.name)],
      'Dary archaniołów': [...shots.map(s => s.name), 'Pool', 'Aura'],
      'Dary wspólne': ['Shield', 'FlameRing', 'Dove', 'FirePillar', 'Shockwave'],
      'Światło, manna, relikwiarze': ['LightShard', 'Manna', 'Reliquary', 'Glow'],
      'Efekty': ['BurstShadow', 'BurstLight', 'BurstFire', 'BurstHeal', 'HitSpark', 'Arrow'],
      'Dotyk': ['Joystick', 'TouchStrike', 'TouchPrayer', 'TouchBreath'],
    },
    groups: [
      ['Heroes', heroes.map(h => h.name)],
      ['Traumas', enemies.map(e => e.name)],
      ['Targets', [...enemies.map(e => e.name), 'Liar', 'ChainPylon']],
      ['Memories', memories.map(m => m.name)],
      ['Bosses', bosses.map(b => b.name)],
      ['PropsAll', props.map(p => p.name)],
      ['Shots', shots.map(s => s.name)],
    ],
  };
}

// ─── setup ─────────────────────────────────────────────────────────────────────────────────────

function setupEvents() {
  const prop = names => names.map(n => ev([], [A('PushString', 'Props', q(n))]));
  const X = '(SceneWindowWidth() - 900) / 2';
  return group('Setup', [
    comment('A chapter starts: its place (colours, floor painting), the chosen archangel with his own gift at level 1, springs of living water spread over the map, the HUD and the intro card. Gifts of the run start from zero; the Fruits of the Spirit are lasting.'),
    ev([begins()], [
      set('Chapter', '=', 'Run.chapter'),
      setS('ChapterId', '=', `${CH}.id`),
      setS('SigId', '=', '"sig-" + Run.hero'),
      set('StageCount', '=', `VariableChildCount(${CH}.stages)`),
      set('Run.light', '=', '0'), set('Run.destroyed', '=', '0'), set('Run.bestCombo', '=', '0'), set('Run.falls', '=', '0'),
      set('Run.focusHeld', '=', '0'), set('Run.level', '=', '1'), set('Run.time', '=', '0'), set('Run.reframes', '=', '0'), set('Run.recognized', '=', '0'),
      set('Run.stage', '=', '0'), set('Run.memories', '=', '0'), set('Run.voices', '=', '0'), set('Run.healed', '=', '0'),
      A('ClearVariableChildren', 'Run.weapons'), A('ClearVariableChildren', 'Run.virtues'),
      set('Prayer', '=', '0'), set('Xp', '=', '0'), set('XpNext', '=', 'Tuning.xpFirst'), set('Level', '=', '1'),
      set('Rerolls', '=', '1'),
      set('Stage', '=', '1'), set('StageTime', '=', 'Tuning.stageSeconds'), set('SpawnT', '=', '1.2'), setB('StageBegin', true),
      set('VoiceT', '=', 'Tuning.voiceGap * 0.5'), set('VoiceNext', '=', '0'),
      setS('State', '=', q('intro')), set('StateT', '=', '0'), setB('HelmUsed', false), setB('StatsDirty', true), setB('HudDirty', true),
      setS('Ui.top', '=', '""'),
      A('SceneBackground', `${CH}.look.background`),
      A('Scene3D::Cube3DObject::SetTint', 'Floor', `${CH}.look.floor`),
      A('Scene3D::SetCameraZ', '=', 'CamZ', '""'),
      A('Scene3D::SetCameraRotationX', '=', 'CamTilt', '""'),
      A('SetCameraCenterX', '=', '0', '""'),
      A('SetCameraCenterY', '=', 'CamZ * tan(ToRad(CamTilt)) - CamLead', '""'),
      A('CreateByName', 'Heroes', '"Hero_" + Run.hero', '0', '0', '""'),
      A('MendiFocus::Reset'),
      A('Psalm150::SetMood', `${CH}.track`, q('battle'), '0.3'),
    ], [
      ...applyQuality(),
      ...SKILL_IDS.map(id => ev([], [set(G(id), '=', '0'), setB(`Run.evo["${id}"]`, false)])),
      ev([], [A('HolyHoly::TakeSkill', 'SigId', 'no')]),
      ev([isB('Save.settings.gentle', true)], [set('Rerolls', '+', '1')]),
      ev([hero('barachiel')], [set('Rerolls', '+', '1')]),
      ...CHAPTER_IDS.map(id => ev([isS('ChapterId', '=', q(id))], [A('Scene3D::Cube3DObject::SetFaceResource', 'Floor', q('front'), floorTexture(id))])),
      ev([hero('selafiel')], [A('Create', 'Aura', PX, PY, '""'), setZ('Aura', '4'), size('Aura', '1', '1')]),
      ev([], [], prop(['ColumnBroken', 'Rock', 'Candle', 'Tree', 'Pew', 'Column', 'Candle', 'Rock'])),
      comment('Props: ruins of the inner world, scattered over the whole map, never at the centre where the angel starts.'),
      ev([], [], [repeat('40', [], [
        set('pa', '=', 'RandomFloatInRange(0, 360)'),
        set('pd', '=', `RandomFloatInRange(480, ${R} - 180)`),
        A('CreateByName', 'PropsAll', 'Props[RandomInRange(0, VariableChildCount(Props) - 1)]', 'cos(ToRad(pa)) * pd', 'sin(ToRad(pa)) * pd', '""'),
        A('SetAngle', 'PropsAll', '=', 'RandomFloatInRange(0, 360)'),
      ])], { vars: { pa: 0, pd: 0 } }),
      comment('Springs of living water (J 4,14): one in each third of the map, at different distances.'),
      ev([], [set('pa', '=', 'RandomFloatInRange(0, 360)')], [repeat('Tuning.springs', [], [
        set('pd', '=', `RandomFloatInRange(650, ${R} - 450)`),
        A('Create', 'Spring', `cos(ToRad(pa + k * 360 / Tuning.springs)) * pd`, `sin(ToRad(pa + k * 360 / Tuning.springs)) * pd`, '""'),
        setZ('Spring', '3'), oset('Spring', 'Water', '=', 'Tuning.springWater'),
      ], [], { index: 'k' })], { vars: { pa: 0, pd: 0, k: 0 } }),
      ev([C('HolyHoly::IsTouchDevice')], [A('ShowLayer', q('Touch')), setB('Ui.touch', true)]),
      ev([NOT(C('HolyHoly::IsTouchDevice'))], [A('HideLayer', q('Touch'))]),
      comment('The intro card: the place, the chapter, the lie in its own figure, and the archangel who keeps watch.'),
      ev([], [
        box(X, '110', '900', '480', { panel: 'intro' }),
        label('UiSmall', `${X} + 40`, '134', 820, '', { panel: 'intro', align: 'center', h: 30, expr: `ToUpperCase(HolyHoly::G(${CH}.place))` }),
        label('UiTitle', `${X} + 40`, '166', 820, '', { panel: 'intro', align: 'center', h: 64, expr: `${CH}.title + " · " + HolyHoly::G(${CH}.theme)` }),
        label('UiText', `${X} + 50`, '244', 800, '', { panel: 'intro', align: 'center', h: 100, expr: `"Kłamstwo tego rozdziału przyjdzie jako " + ${CH}.boss.name + ": „" + HolyHoly::G(${CH}.boss.lie) + "”"` }),
        label('UiSmall', `${X} + 50`, '356', 800, '', { panel: 'intro', align: 'center', key: 'introHow', h: 140, expr: `"Czuwa " + ${HERO}.name + ". Stój, a jego dar sam uderzy; spacja to cios, E to modlitwa, Q to westchnienie, które leczy. Trzy etapy, trzy pory dnia: szukaj wspomnień, ucisz głosy, stań w źródle, gdy boli."` }),
        label('UiSmall', `${X} + 50`, '540', 800, 'Naciśnij dowolny klawisz lub dotknij ekranu', { panel: 'intro', align: 'center', key: 'introHint', h: 30 }),
      ]),
    ], { vars: {} }),
  ]);
}

function introEvents() {
  return group('Intro', [
    ev([isS('State', '=', q('intro'))], [set('StateT', '+', dt), A('ActivateBehavior', 'Player', 'TopDownMovement', 'no')], [
      ev([OR(cmp('StateT', '>', '9'), AND(cmp('StateT', '>', '0.8'), OR(C('AnyKeyPressed'), C('HasAnyTouchOrMouseStarted'))))], [
        setS('State', '=', q('play')),
        A('ActivateBehavior', 'Player', 'TopDownMovement', 'yes'),
        sfx('door'),
      ], closePanel('intro')),
      ev([oisS('UiSmall', 'Key', '=', q('introHint'))], [opacity('UiSmall', '160 + 95 * sin(TimeFromStart() * 4)')]),
      ev([oisS('UiSmall', 'Key', '=', q('introHow')), isB('Ui.touch', true), C('BuiltinCommonInstructions::Once')], [text('UiSmall', `"Czuwa " + ${HERO}.name + ". Stój, a jego dar sam uderzy; gwiazda to cios, płomień to modlitwa, niebieski krąg to westchnienie, które leczy. Szukaj wspomnień, ucisz głosy, stań w źródle, gdy boli."`)]),
    ]),
  ]);
}

// ─── stats: the archangel, his gifts, the virtues and the fruits → numbers ───────────────────────

function statsEvents() {
  const L = SIG;
  const perHero = {
    uriel: [
      set('St.shotDamage', '=', `12 * (1 + 0.3 * ${step(L, 2)} + 0.3 * ${step(L, 5)})`), set('St.shotCooldown', '=', `0.42 / (1 + 0.25 * ${step(L, 3)})`),
      set('St.shotSpeed', '=', `1000 * (1 + 0.2 * ${step(L, 3)})`), set('St.shotPierce', '=', step(L, 4)), set('St.burn', '=', `6 * (1 + 0.5 * ${step(L, 5)})`),
      set('St.shotCount', '=', '1'), set('St.shotArc', '=', '10'), set('St.shotLife', '=', '1.2'),
    ],
    michal: [
      set('St.shotDamage', '=', `24 * (1 + 0.3 * ${step(L, 2)} + 0.4 * ${step(L, 5)})`), set('St.shotCooldown', '=', `0.85 / (1 + 0.3 * ${step(L, 4)})`),
      set('St.shotSpeed', '=', '1150'), set('St.shotPierce', '=', `1 + ${step(L, 3)}`), set('St.burn', '=', '0'),
      set('St.shotCount', '=', '1'), set('St.shotArc', '=', '10'), set('St.shotLife', '=', '1'),
    ],
    gabriel: [
      set('St.shotDamage', '=', `15 * (1 + 0.3 * ${step(L, 2)} + 0.3 * ${step(L, 5)})`), set('St.shotCooldown', '=', `1 / (1 + 0.25 * ${step(L, 5)})`),
      set('St.shotSpeed', '=', '430'), set('St.shotPierce', '=', '99'), set('St.burn', '=', '0'), set('St.shotSize', '=', `1 + 0.4 * ${step(L, 3)}`),
      set('St.shotCount', '=', `1 + ${step(L, 4)}`), set('St.shotArc', '=', '24'), set('St.shotLife', '=', '1.7'),
    ],
    rafal: [
      set('St.shotDamage', '=', '6'), set('St.shotCooldown', '=', '1.3'), set('St.shotSpeed', '=', '620'), set('St.shotPierce', '=', '0'), set('St.burn', '=', '0'),
      set('St.shotCount', '=', `1 + ${step(L, 5)}`), set('St.shotArc', '=', '30'), set('St.shotLife', '=', '0.55'),
      set('St.poolR', '=', `130 * (1 + 0.3 * ${step(L, 2)})`), set('St.poolDps', '=', `30 * (1 + 0.4 * ${step(L, 4)})`), set('St.poolHeal', '=', `0.12 + 0.1 * ${step(L, 3)}`),
      set('St.poolLife', '=', '3'), set('St.poolSlow', '=', '0'),
    ],
    selafiel: [
      set('St.aura', '=', `160 * (1 + 0.25 * ${step(L, 2)} + 0.25 * ${step(L, 5)})`), set('St.auraDps', '=', `34 * (1 + 0.4 * ${step(L, 3)} + 0.3 * ${step(L, 5)})`),
      set('St.auraSlow', '=', `0.3 + 0.2 * ${step(L, 4)}`), set('St.shotCount', '=', '0'),
    ],
    jehudiel: [
      set('St.shotDamage', '=', `20 * (1 + 0.3 * ${step(L, 2)} + 0.4 * ${step(L, 5)})`), set('St.shotCooldown', '=', `0.6 / (1 + 0.3 * ${step(L, 4)})`),
      set('St.shotSpeed', '=', '950'), set('St.shotPierce', '=', '3'), set('St.burn', '=', '0'),
      set('St.shotCount', '=', '3'), set('St.shotArc', '=', '30'), set('St.shotLife', '=', `0.24 * (1 + 0.4 * ${step(L, 3)})`),
    ],
    barachiel: [
      set('St.shotDamage', '=', `9 * (1 + 0.3 * ${step(L, 2)})`), set('St.shotCooldown', '=', '0.45'), set('St.shotSpeed', '=', '900'),
      set('St.shotPierce', '=', step(L, 4)), set('St.burn', '=', '0'),
      set('St.shotCount', '=', `2 + ${step(L, 3)} + ${step(L, 5)}`), set('St.shotArc', '=', '22'), set('St.shotLife', '=', '1'),
    ],
  };
  const evolved = {
    uriel: [set('St.shotCount', '=', '3'), set('St.shotArc', '=', '26'), set('St.shotPierce', '=', '2'), set('St.burn', '*', '1.6')],
    michal: [set('St.shotCount', '=', '5'), set('St.shotArc', '=', '288'), set('St.shotPierce', '=', '99')],
    gabriel: [set('St.shotSize', '*', '1.2')],
    rafal: [set('St.poolR', '*', '2'), set('St.poolLife', '=', '5'), set('St.poolSlow', '=', '0.4')],
    selafiel: [set('St.aura', '*', '1.5')],
    jehudiel: [set('St.shotCount', '=', '5'), set('St.shotArc', '=', '60'), set('St.shotLife', '*', '1.3')],
    barachiel: [set('St.shotCount', '=', '7'), set('St.shotArc', '=', '50'), set('St.shotPierce', '=', '3')],
  };
  return group('Stats', [
    comment('Everything the archangel, the gifts of this run, the virtues and the Fruits of the Spirit change, recomputed when something is taken. step(level, n) is 1 from level n on.'),
    ev([isB('StatsDirty', true)], [
      setB('StatsDirty', false), setB('HudDirty', true),
      set('St.dmgMul', '=', `(1 + 0.08 * Save.fruits.lagodnosc) * ${HERO}.stats.damage`),
      set('St.shotSize', '=', '1'),
      set('St.shotRange', '=', 'Tuning.shotRange * (1 + 0.15 * Save.fruits.pokoj)'),
      set('St.speed', '=', `Tuning.playerSpeed * ${HERO}.stats.speed * (1 + 0.12 * ${G('sandaly')})`),
      set('St.magnet', '=', `Tuning.magnet * (1 + 0.4 * ${G('ryba')}) * (1 + 0.25 * Save.fruits.uprzejmosc)`),
      set('St.dodge', '=', `12 * ${G('pancerz')}`),
      set('St.lightMul', '=', `(1 + 0.1 * Save.fruits.radosc) * ${HERO}.stats.light`),
      set('St.prayerMul', '=', `${HERO}.stats.prayer * (1 + 0.15 * Save.fruits.wiernosc)`),
      set('St.comboWindow', '=', `Tuning.comboWindow + 0.25 * Save.fruits.cierpliwosc + 0.3 * ${G('przebaczenie')}`),
      set('St.grace', '=', `Tuning.grace + 0.4 * Save.fruits.dobroc + 0.4 * ${G('przebaczenie')}`),
      set('St.punchDamage', '=', `Tuning.punchDamage * (1 + 0.4 * ${step(G('samson'), 1)} + 0.4 * ${step(G('samson'), 3)})`),
      set('St.punchReach', '=', `Tuning.punchReach * (1 + 0.25 * ${step(G('samson'), 2)})`),
      set('St.punchCooldown', '=', 'Tuning.punchCooldown'),
      set('St.hpMul', '=', `1 - 0.1 * ${G('milosc')}`),
      set('MaxHearts', '=', `Tuning.baseHearts + ${HERO}.stats.hearts - 5 + Save.fruits.milosc + ${G('serce')}`),
      // the shared gifts and their evolutions
      set('St.tarczaN', '=', G('tarcza')), set('St.tarczaDmg', '=', `10 + 7 * ${G('tarcza')}`), set('St.tarczaR', '=', '120'),
      set('St.ogienR', '=', `125 + 18 * ${G('ogien')}`), set('St.ogienTick', '=', `0.7 - 0.06 * ${G('ogien')}`), set('St.ogienDmg', '=', `5 + 4 * ${G('ogien')}`),
      set('St.wicherT', '=', `7 - ${G('wicher')}`), set('St.wicherR', '=', `360 + 40 * ${G('wicher')}`), set('St.wicherDmg', '=', `12 * ${step(G('wicher'), 4)}`),
      set('St.doveCd', '=', `1.9 - 0.3 * ${G('golebica')}`), set('St.doveDmg', '=', `18 + 8 * ${G('golebica')}`),
      set('St.eliaszT', '=', `4 - ${step(G('eliasz'), 3)}`), set('St.eliaszN', '=', `1 + ${step(G('eliasz'), 4)}`), set('St.eliaszR', '=', `110 + 35 * ${step(G('eliasz'), 2)}`), set('St.eliaszDmg', '=', `40 + 15 * ${G('eliasz')}`),
      set('St.jerT', '=', `9 - ${G('jerycho')}`), set('St.jerStun', '=', `1 + 0.5 * ${G('jerycho')}`), set('St.jerDmg', '=', `20 * ${step(G('jerycho'), 3)}`),
      set('St.slingCd', '=', `3 - 0.8 * ${step(G('dawid'), 3)}`), set('St.slingDmg', '=', `55 + 25 * ${G('dawid')}`), set('St.slingPierce', '=', `2 * ${step(G('dawid'), 4)}`),
    ], [
      ev([isB('Save.settings.gentle', true)], [set('MaxHearts', '+', '2'), set('St.hpMul', '*', '0.7')]),
      ev([hero('michal')], [set('St.grace', '+', '0.3')]),
      ev([hero('jehudiel')], [set('St.punchCooldown', '*', '0.8')]),
      ev([cmp('CrownT', '>', '0')], [set('St.dmgMul', '*', '2'), set('St.punchCooldown', '*', '0.5'), set('St.magnet', '=', '3000')]),
      ...Object.entries(perHero).map(([id, actions]) => ev([hero(id)], actions)),
      ...Object.entries(evolved).map(([id, actions]) => ev([hero(id), evo(`sig-${id}`)], actions)),
      comment('Rozmnożenie chlebów: one more missile per level (or a wider pool, a wider cloud).'),
      ev([NOT(hero('rafal')), NOT(hero('selafiel'))], [set('St.shotCount', '+', G('chleby'))]),
      ev([hero('rafal')], [set('St.poolR', '*', `1 + 0.15 * ${G('chleby')}`)]),
      ev([hero('selafiel')], [set('St.aura', '*', `1 + 0.1 * ${G('chleby')}`)]),
      ev([], [
        set('St.shotDamage', '*', 'St.dmgMul'), set('St.poolDps', '*', 'St.dmgMul'), set('St.auraDps', '*', 'St.dmgMul'), set('St.punchDamage', '*', 'St.dmgMul'),
        set('St.shotCooldown', '/', '1 + 0.1 * Save.fruits.opanowanie'),
        set('Hearts', '=', 'min(Hearts, MaxHearts)'),
      ]),
      ev([evo('tarcza')], [set('St.tarczaN', '=', '6'), set('St.tarczaDmg', '*', '2'), set('St.tarczaR', '=', '150')]),
      ev([evo('ogien')], [set('St.ogienR', '*', '2'), set('St.ogienTick', '=', '0.25')]),
      ev([evo('wicher')], [set('St.wicherT', '=', '2'), set('St.wicherR', '+', '120'), set('St.wicherDmg', '=', '30')]),
      ev([evo('golebica')], [set('St.doveCd', '*', '0.5'), set('St.doveDmg', '*', '3')]),
      ev([evo('eliasz')], [set('St.eliaszT', '=', '2'), set('St.eliaszN', '=', '4')]),
      ev([evo('jerycho')], [set('St.jerT', '=', '5'), set('St.jerStun', '=', '4'), set('St.jerDmg', '=', '40')]),
      ev([evo('dawid')], [set('St.slingCd', '=', '1'), set('St.slingDmg', '*', '3'), set('St.slingPierce', '=', '99')]),
      ev([], [
        set('St.tarczaDmg', '*', 'St.dmgMul'), set('St.ogienDmg', '*', 'St.dmgMul'), set('St.wicherDmg', '*', 'St.dmgMul'), set('St.doveDmg', '*', 'St.dmgMul'),
        set('St.eliaszDmg', '*', 'St.dmgMul'), set('St.jerDmg', '*', 'St.dmgMul'), set('St.slingDmg', '*', 'St.dmgMul'),
        A('FireBullet::FireBullet::SetCooldownOp', 'Player', 'ShotGun', '=', 'St.shotCooldown'),
        A('FireBullet::FireBullet::SetBulletQuantityOp', 'Player', 'ShotGun', '=', 'max(1, St.shotCount)'),
        A('FireBullet::FireBullet::SetFiringArcOp', 'Player', 'ShotGun', '=', 'St.shotArc + 8 * max(0, St.shotCount - 3)'),
        A('FireBullet::FireBullet::SetCooldownOp', 'Player', 'SlingGun', '=', 'St.slingCd'),
        A('TopDownMovementBehavior::MaxSpeed', 'Player', 'TopDownMovement', '=', 'St.speed'),
      ]),
      comment('Shields of faith and tongues of fire: as many objects as the gift asks for.'),
      ev([cmp('SceneInstancesCount(Shield)', '!=', 'St.tarczaN')], [A('Delete', 'Shield')], [
        repeat('St.tarczaN', [], [A('Create', 'Shield', PX, PY, '""'), oset('Shield', 'Index', '=', 'k')], [], { index: 'k' }),
      ], { vars: { k: 0 } }),
      ev([evo('tarcza')], [scale('Shield', '1.4')]),
      ev([cmp('SceneInstancesCount(FlameRing)', '!=', `${G('ogien')} * 2 + ${step(G('ogien'), 1)}`)], [A('Delete', 'FlameRing')], [
        repeat(`${G('ogien')} * 2 + ${step(G('ogien'), 1)}`, [], [A('Create', 'FlameRing', PX, PY, '""'), oset('FlameRing', 'Index', '=', 'k')], [], { index: 'k' }),
      ], { vars: { k: 0 } }),
      ev([cmp(G('golebica'), '>', '0'), cmp('SceneInstancesCount(Dove)', '=', '0')], [A('Create', 'Dove', PX, PY, '""'), setZ('Dove', '120')]),
    ]),
    ev([cmp('CrownT', '>', '0')], [set('CrownT', '-', dt)], [ev([cmp('CrownT', '<=', '0')], [setB('StatsDirty', true), ...banner(q('Korona wraca do Jehudiela'), 1.2)])]),
  ]);
}

// ─── the angel: moving, standing still ─────────────────────────────────────────────────────────

function movementEvents() {
  return group('Angel', [
    comment('Arrows move by themselves; WASD is mapped onto the same controls. On touch screens the joystick (left thumb) drives the same Top-down movement behavior. The archangel\'s painting follows the light at his feet.'),
    ev([playing(), key('w')], [A('TopDownMovementBehavior::SimulateUpKey', 'Player', 'TopDownMovement')]),
    ev([playing(), key('s')], [A('TopDownMovementBehavior::SimulateDownKey', 'Player', 'TopDownMovement')]),
    ev([playing(), key('a')], [A('TopDownMovementBehavior::SimulateLeftKey', 'Player', 'TopDownMovement')]),
    ev([playing(), key('d')], [A('TopDownMovementBehavior::SimulateRightKey', 'Player', 'TopDownMovement')]),
    ev([playing(), C('SpriteMultitouchJoystick::HasTouchStartedOnScreenSide', 'Joystick', q('Left'))], [A('SpriteMultitouchJoystick::SpriteMultitouchJoystick::TeleportAndPress', 'Joystick')]),
    ev([NOT(playing())], [A('ActivateBehavior', 'Player', 'TopDownMovement', 'no')]),
    ev([playing()], [A('ActivateBehavior', 'Player', 'TopDownMovement', 'yes')]),
    comment('Standing still is prayer: the gift acts and the prayer grows (Ps 46,11).'),
    ev([playing(), C('TopDownMovementBehavior::IsMoving', 'Player', 'TopDownMovement')], [set('Still', '=', '0')]),
    ev([playing(), NOT(C('TopDownMovementBehavior::IsMoving', 'Player', 'TopDownMovement'))], [set('Still', '+', dt)]),
    ev([cmp('DashT', '>', '0')], [set('DashT', '-', dt), A('AddForceAL', 'Player', 'DashA', '1500', '0')]),
    ev([], [A('SeparateFromObjects', 'Player', 'PropsAll')]),
    ev([cmp('Player.DistanceToPosition(0, 0)', '>', `${R} - 50`)], [
      A('SetXY', 'Player', '=', `Player.X() * (${R} - 50) / Player.DistanceToPosition(0, 0)`, '=', `Player.Y() * (${R} - 50) / Player.DistanceToPosition(0, 0)`),
    ]),
    comment('Grief weighs: walking through it slows the angel (it does not wound).'),
    ev([cmp('Heavy', '>', '0')], [set('Heavy', '-', dt), A('TopDownMovementBehavior::MaxSpeed', 'Player', 'TopDownMovement', '=', 'St.speed * 0.55')]),
    ev([cmp('Heavy', '<=', '0')], [A('TopDownMovementBehavior::MaxSpeed', 'Player', 'TopDownMovement', '=', 'St.speed')]),
    ev([], [A('SetXY', 'Heroes', '=', PX, '=', `${PY} + 1`), A('SetXY', 'Aura', '=', PX, '=', PY)]),
  ]);
}

// ─── the archangel's prayer (his own power) ───────────────────────────────────────────────────────

function prayerEvents() {
  const around = (radius, actions) => ev([C('Distance', 'Targets', 'Player', radius)], actions);
  const ult = {
    uriel: [
      ev([], [], [repeat('8', [], [], [
        ev([C('Distance', 'Traumas', 'Player', '900'), C('PickRandomInstance', 'Traumas')], [
          A('Create', 'FirePillar', 'Traumas.X()', 'Traumas.Y()', '""'), setZ('FirePillar', '420'), oset('FirePillar', 'Radius', '=', '150'), oset('FirePillar', 'Damage', '=', '120 * St.dmgMul'),
          A('Tween::AddObjectPositionZTween2', 'FirePillar', 'Tween', 'Object3D', q('fall'), '0', q('easeInQuad'), '0.25', 'no'),
        ]),
      ])]),
      ev([C('Distance', 'Traumas', 'Player', '450')], [oset('Traumas', 'BurnT', '=', '4'), oset('Traumas', 'BurnDps', '=', '30 * St.dmgMul')]),
      ev([], [...particle('BurstFire', PX, PY, '40')]),
    ],
    michal: [
      around('1100', [oset('Targets', 'Hp', '-', '300 * St.dmgMul * Targets.Armor'), oset('Targets', 'Stun', '=', 'max(Targets.Stun, 1.5)'), oset('Targets', 'HitT', '=', '1')]),
      ev([], [A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '1100'), oset('Shockwave', 'Life', '=', '0.6'), ...particle('BurstLight', PX, PY, '80')]),
    ],
    gabriel: [
      ev([], [oset('Traumas', 'Stun', '=', 'max(Traumas.Stun, 4)'), A('Delete', 'Arrow'), A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '1600'), oset('Shockwave', 'Life', '=', '0.9'), sfx('door')]),
    ],
    rafal: [
      ev([], [set('Hearts', '=', 'MaxHearts'), set('Invuln', '=', '4'), A('Create', 'Pool', PX, PY, '""'), oset('Pool', 'Radius', '=', '480'), oset('Pool', 'Life', '=', '6'), setZ('Pool', '3'), ...particle('BurstHeal', PX, PY, '40')]),
    ],
    selafiel: [
      ev([], [oset('Traumas', 'Slow', '=', '0.75'), oset('Traumas', 'SlowT', '=', '6'), oset('Traumas', 'Hp', '-', '60 * St.dmgMul * Traumas.Armor')]),
      ev([], [A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '1400'), oset('Shockwave', 'Life', '=', '1.2')]),
    ],
    jehudiel: [
      ev([], [set('CrownT', '=', '8'), setB('StatsDirty', true), ...particle('BurstLight', PX, PY, '120')]),
    ],
    barachiel: [
      around('900', [oset('Targets', 'Hp', '-', '200 * St.dmgMul * Targets.Armor'), oset('Targets', 'HitT', '=', '1')]),
      ev([], [], [repeat('3', [], [A('Create', 'Manna', `${PX} + cos(ToRad(k * 120)) * 160`, `${PY} + sin(ToRad(k * 120)) * 160`, '""')], [], { index: 'k', vars: { k: 0 } })]),
      ev([], [A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '900'), oset('Shockwave', 'Life', '=', '0.6'), ...particle('BurstLight', PX, PY, '60')]),
    ],
  };
  return group('Prayer of the archangel', [
    comment('Stillness (or the Mendi band, MendiFocus extension) and broken shadows fill the prayer. Full, it can be prayed (E / K / the flame button): each archangel has his own. The Prayer is the archangel\'s, given by God; it is never Christ\'s presence on demand.'),
    ev([playing()], [
      A('MendiFocus::Update', dt, 'Still'),
      set('Prayer', '=', `min(100, Prayer + 100 / Tuning.prayerSeconds * MendiFocus::ChargeFactor() * St.prayerMul * ${dt})`),
      set('Run.focusHeld', '=', 'max(Run.focusHeld, MendiFocus::HeldSeconds())'),
    ]),
    ev([cmp('Prayer', '>=', '100'), isB('PrayerFull', false)], [setB('PrayerFull', true), sfx('flame', '3'), ...banner(`"Modlitwa gotowa: " + ${HERO}.ultimate.name`, 1.6)]),
    ev([cmp('Prayer', '<', '100')], [setB('PrayerFull', false)]),
    ev([playing(), C('MendiFocus::TierJustRose')], [sfx('tier', '2'), ...banner('"Czuwanie ×" + HolyHoly::Decimal(MendiFocus::Multiplier())', 1.6)]),
    ev([playing(), OR(keyJust('e'), keyJust('k'), C('SpriteMultitouchJoystick::IsButtonJustPressed', '1', q('B')))], [setB('UltNow', true)]),
    ev([playing(), C('MouseButtonFromTextReleased', q('Left')), C('IsCursorOnObject', 'UiArt'), oisS('UiArt', 'Key', '=', q('ult'))], [setB('UltNow', true)]),
    ev([isB('UltNow', true), cmp('Prayer', '>=', '100')], [
      setB('UltNow', false), set('Prayer', '=', '0'),
      ...banner(`${HERO}.ultimate.name`, 2.4), sfx('ultimate'), shake('0.5'), A('HolyHoly::Vibrate', '120'),
    ], Object.entries(ult).map(([id, list]) => ev([hero(id)], [], list))),
    ev([isB('UltNow', true)], [setB('UltNow', false), sfx('weaken'), ...banner(q('Modlitwa jeszcze się ładuje: stań w ciszy'), 1.6)]),
  ]);
}

// ─── the archangel's own gift (Archero: it acts while the angel stands still) ──────────────────

function signatureEvents() {
  const fire = (id, object, extra = []) => ev([
    playing(), hero(id), cmp('Still', '>=', 'Tuning.stillDelay'), C('Distance', 'Targets', 'Player', 'St.shotRange'), oisB('Targets', 'Dying', false), C('PickNearest', 'Targets', PX, PY),
  ], [
    A('FireBullet::FireBullet::FireTowardPosition', 'Player', 'ShotGun', PX, PY, object, 'Targets.X()', 'Targets.Y()', 'St.shotSpeed'),
    oset(object, 'Damage', '=', 'St.shotDamage'), oset(object, 'Pierce', '=', 'St.shotPierce'), oset(object, 'Burn', '=', 'St.burn'), oset(object, 'Life', '=', 'St.shotLife'),
    setZ(object, '42'),
    ...extra,
  ]);
  const hits = (shot, actions = [], events = []) => [
    ev([C('CollisionNP', shot, 'Targets'), ois(shot, 'Grace', '<=', '0'), oisB('Targets', 'Dying', false)], [
      oset('Targets', 'Hp', '-', `${shot}.Damage * Targets.Armor`),
      oset('Targets', 'Stun', '=', 'max(Targets.Stun, 0.08)'),
      oset('Targets', 'HitT', '=', '1'),
      oset(shot, 'Pierce', '-', '1'),
      oset(shot, 'Grace', '=', '0.14'),
      ...particle('HitSpark', `${shot}.X()`, `${shot}.Y()`, '40'),
      sfx('hit', '0', `clamp((${shot}.X() - CameraCenterX("")) / 600, -1, 1)`),
      ...actions,
    ], [
      ev([ois(shot, 'Burn', '>', '0')], [oset('Targets', 'BurnT', '=', '2.5'), oset('Targets', 'BurnDps', '=', `max(Targets.BurnDps, ${shot}.Burn)`)]),
      ev([ois('Targets', 'Armor', '<=', '0'), oisS('Targets', 'Kind', '=', q('tesknota'))], [...banner(q('Tęsknoty nie pokona się siłą. Stań przy niej w ciszy.'), 1.6)]),
      ev([ois('Targets', 'Armor', '<=', '0'), oisS('Targets', 'Kind', '=', q('liar'))], [...banner(q('Łańcuchy chronią kłamstwo: rozbij je ciosem!'), 1.4)]),
      ...events,
    ]),
    ev([ois(shot, 'Pierce', '<', '0')], [A('Delete', shot)]),
  ];
  return group('Gift of the archangel', [
    comment('Each archangel acts in his own way while the angel stands still: Uriel\'s flame sets shadows alight, Michael\'s spear pierces a line, Gabriel\'s lantern sends a slow globe through everything, Raphael\'s balm spills healing pools, Selaphiel\'s incense grows around him, Jehudiel\'s three cords lash close by, Barachiel\'s petals fan out. FireBullet extension: cooldown, fan of missiles.'),
    fire('uriel', 'Bolt'),
    fire('michal', 'Spear'),
    fire('gabriel', 'Orb', [scale('Orb', 'St.shotSize')]),
    fire('rafal', 'Vial'),
    fire('jehudiel', 'Lash'),
    fire('barachiel', 'Petal'),
    ev([C('FireBullet::FireBullet::HasJustFired', 'Player', 'ShotGun')], [sfx('shoot', '0', '0')]),
    ev([], [oset('Shots', 'Grace', '-', dt), oset('Shots', 'Life', '-', dt)]),
    ...hits('Bolt'),
    ...hits('Spear'),
    ...hits('Orb'),
    ...hits('Petal'),
    ...hits('Stone'),
    ...hits('Lash', [oset('Targets', 'KnockT', '=', '0.2'), oset('Targets', 'KnockA', '=', `Targets.AngleToPosition(${PX}, ${PY}) + 180`), oset('Targets', 'KnockS', '=', '1100')], [
      ev([evo('sig-jehudiel')], [oset('Targets', 'Stun', '=', 'max(Targets.Stun, 0.4)')]),
    ]),
    comment('Gabriel\'s globe: when it ends, an evolved lantern bursts into light.'),
    forEach('Orb', [ois('Orb', 'Life', '<=', '0'), evo('sig-gabriel')], [
      A('Create', 'Shockwave', 'Orb.X()', 'Orb.Y()', '""'), oset('Shockwave', 'Radius', '=', '170'), oset('Shockwave', 'Life', '=', '0.3'),
      ...particle('BurstLight', 'Orb.X()', 'Orb.Y()', '40'),
    ], [ev([C('Distance', 'Targets', 'Orb', '170')], [oset('Targets', 'Hp', '-', 'St.shotDamage * 1.5 * Targets.Armor'), oset('Targets', 'HitT', '=', '1')])]),
    comment('Raphael\'s vessel spills a pool where it lands (or where it meets a shadow).'),
    forEach('Vial', [OR(ois('Vial', 'Life', '<=', '0'), C('CollisionNP', 'Vial', 'Traumas'))], [
      A('Create', 'Pool', 'Vial.X()', 'Vial.Y()', '""'), setZ('Pool', '3'),
      oset('Pool', 'Radius', '=', 'St.poolR'), oset('Pool', 'Life', '=', 'St.poolLife'), oset('Pool', 'Tick', '=', '0'),
      ...particle('BurstHeal', 'Vial.X()', 'Vial.Y()', '30'),
      A('Delete', 'Vial'),
    ]),
    ev([ois('Shots', 'Life', '<=', '0')], [A('Delete', 'Shots')]),
    ev([NOT(C('Distance', 'Shots', 'Player', '1300'))], [A('Delete', 'Shots')]),
    group('Pools of balm', [
      ev([], [oset('Pool', 'T', '+', dt), oset('Pool', 'Tick', '-', dt)], [
        ev([], [size('Pool', 'Pool.Radius * 2 * min(1, Pool.T * 5) * clamp((Pool.Life - Pool.T) * 3, 0, 1) + 1', 'Pool.Radius * 2 * min(1, Pool.T * 5) * clamp((Pool.Life - Pool.T) * 3, 0, 1) + 1')]),
        forEach('Pool', [ois('Pool', 'Tick', '<=', '0')], [oset('Pool', 'Tick', '=', '0.5')], [
          ev([C('Distance', 'Traumas', 'Pool', 'Pool.Radius')], [oset('Traumas', 'Hp', '-', 'St.poolDps * 0.5 * Traumas.Armor'), oset('Traumas', 'HitT', '=', '0.6')], [
            ev([cmp('St.poolSlow', '>', '0')], [oset('Traumas', 'Slow', '=', 'max(Traumas.Slow, St.poolSlow)'), oset('Traumas', 'SlowT', '=', '0.6')]),
          ]),
        ]),
        forEach('Pool', [C('Distance', 'Player', 'Pool', 'Pool.Radius'), playing()], [set('Regen', '+', `St.poolHeal * ${dt}`)]),
        ev([ois('Pool', 'T', '>=', 'Pool.Life')], [A('Delete', 'Pool')]),
      ]),
    ]),
    group('Incense of Selaphiel', [
      ev([hero('selafiel'), OR(cmp('Still', '>=', 'Tuning.stillDelay'), evo('sig-selafiel')), playing()], [set('AuraP', '=', `min(1, AuraP + 3 * ${dt})`)]),
      ev([hero('selafiel'), cmp('Still', '<', 'Tuning.stillDelay'), noEvo('sig-selafiel')], [set('AuraP', '=', `max(0, AuraP - 0.7 * ${dt})`)]),
      ev([hero('selafiel')], [size('Aura', 'St.aura * 2 * AuraP + 1', 'St.aura * 2 * AuraP + 1'), set('AuraT', '-', dt)]),
      ev([hero('selafiel'), cmp('AuraT', '<=', '0'), cmp('AuraP', '>', '0.2'), playing()], [set('AuraT', '=', '0.4')], [
        ev([C('Distance', 'Traumas', 'Player', 'St.aura * AuraP')], [
          oset('Traumas', 'Hp', '-', 'St.auraDps * 0.4 * Traumas.Armor'), oset('Traumas', 'HitT', '=', '0.5'),
          oset('Traumas', 'Slow', '=', 'max(Traumas.Slow, St.auraSlow)'), oset('Traumas', 'SlowT', '=', '0.5'),
        ]),
      ]),
    ]),
    group('Healing', [
      comment('Raphael is a physician on the road: a heart comes back every 45 s. Balm pools heal a little at a time.'),
      ev([hero('rafal'), playing()], [set('RegenT', '+', dt)]),
      ev([cmp('RegenT', '>=', '45')], [set('RegenT', '=', '0'), set('Regen', '+', '1')]),
      ev([cmp('Regen', '>=', '1')], [set('Regen', '-', '1')], [
        ev([cmp('Hearts', '<', 'MaxHearts')], [set('Hearts', '+', '1'), sfx('grace'), ...particle('BurstHeal', PX, PY, '50')]),
      ]),
    ]),
  ]);
}

// ─── the strike (Endless Puncher) ──────────────────────────────────────────────────────────────

function strikeEvents() {
  return group('Strike', [
    comment('Endless Puncher: strike (Space / J / the star button / a click) when a shadow is within reach. Strikes in a row build a combo that multiplies damage and light; a strike at nothing breaks it and costs a moment.'),
    ev([playing(), OR(keyJust('Space'), keyJust('j'), C('SpriteMultitouchJoystick::IsButtonJustPressed', '1', q('A')))], [setB('StrikeNow', true)]),
    ev([playing(), C('HasAnyTouchOrMouseStarted'), NOT(C('HolyHoly::IsTouchDevice')), NOT(C('IsCursorOnObject', 'UiButton')), NOT(C('IsCursorOnObject', 'UiArt'))], [setB('StrikeNow', true)]),
    ev([isB('StrikeNow', true), cmp('StrikeCD', '>', '0')], [setB('StrikeNow', false)]),
    ev([isB('StrikeNow', true)], [setB('StrikeNow', false), setB('Hit', false)], [
      ev([C('Distance', 'Targets', 'Player', 'St.punchReach'), oisB('Targets', 'Dying', false), C('PickNearest', 'Targets', PX, PY)], [
        setB('Hit', true),
        set('Combo', '+', '1'), set('ComboT', '=', 'St.comboWindow'), set('Run.bestCombo', '=', 'max(Run.bestCombo, Combo)'),
        oset('Targets', 'Hp', '-', 'St.punchDamage * (1 + 0.1 * min(Combo, 10)) * Targets.PunchMul * Targets.Armor'),
        oset('Targets', 'HitT', '=', '1'),
        oset('Targets', 'KnockT', '=', '0.22'),
        oset('Targets', 'KnockA', '=', `Targets.AngleToPosition(${PX}, ${PY}) + 180`),
        oset('Targets', 'KnockS', '=', '950'),
        oset('Targets', 'Stun', '=', 'max(Targets.Stun, 0.35)'),
        set('DashA', '=', 'Player.AngleToPosition(Targets.X(), Targets.Y())'),
        set('DashT', '=', '0.07'),
        set('StrikeCD', '=', 'St.punchCooldown'),
        set('Prayer', '=', 'min(100, Prayer + Tuning.prayerPerStrike * St.prayerMul)'),
        ...particle('HitSpark', 'Targets.X()', 'Targets.Y()', '50'),
        ...particle('BurstLight', 'Targets.X()', 'Targets.Y()', '50'),
        sfx('combo', 'Combo', 'clamp((Targets.X() - CameraCenterX("")) / 600, -1, 1)'),
        shake('0.12'),
      ]),
      ev([isB('Hit', true), cmp(G('samson'), '>=', '4'), C('Distance', 'Traumas', 'Player', '190')], [
        oset('Traumas', 'KnockT', '=', '0.25'), oset('Traumas', 'KnockA', '=', `Traumas.AngleToPosition(${PX}, ${PY}) + 180`), oset('Traumas', 'KnockS', '=', '700'),
      ]),
      ev([isB('Hit', false)], [set('Combo', '=', '0'), set('StrikeCD', '=', 'Tuning.missCooldown'), set('MissT', '=', '0.6'), sfx('weaken')]),
    ]),
    ev([], [set('StrikeCD', '-', dt), set('MissT', '-', dt)]),
    ev([cmp('Combo', '>', '0'), playing()], [set('ComboT', '-', dt)], [ev([cmp('ComboT', '<=', '0')], [set('Combo', '=', '0')])]),
  ]);
}

// ─── gifts that act by themselves (survivors) ──────────────────────────────────────────────────

function giftEvents() {
  const lvl = id => G(id);
  const knockFrom = (x, y, speed, secs) => [
    oset('Traumas', 'KnockT', '=', secs), oset('Traumas', 'KnockA', '=', `Traumas.AngleToPosition(${x}, ${y}) + 180`), oset('Traumas', 'KnockS', '=', speed),
  ];
  return group('Gifts', [
    group('Tarcza wiary (shields)', [
      ev([cmp('St.tarczaN', '>', '0')], [
        set('Tm.shieldAngle', '+', `(110 + 25 * ${lvl('tarcza')}) * ${dt}`),
        A('SetCenter', 'Shield', '=', `${PX} + cos(ToRad(Tm.shieldAngle + Shield.Index * 360 / St.tarczaN)) * St.tarczaR`, '=', `${PY} + sin(ToRad(Tm.shieldAngle + Shield.Index * 360 / St.tarczaN)) * St.tarczaR`),
        setZ('Shield', '22'),
        A('SetAngle', 'Shield', '=', 'Tm.shieldAngle + Shield.Index * 360 / St.tarczaN'),
      ]),
      ev([C('CollisionNP', 'Shield', 'Traumas'), ois('Traumas', 'ShieldCD', '<=', '0'), playing()], [
        oset('Traumas', 'Hp', '-', 'St.tarczaDmg * Traumas.Armor'), oset('Traumas', 'ShieldCD', '=', '0.5'), oset('Traumas', 'HitT', '=', '1'),
        ...knockFrom(PX, PY, '600', '0.15'),
        ...particle('HitSpark', 'Traumas.X()', 'Traumas.Y()', '30'),
      ]),
      ev([C('CollisionNP', 'Shield', 'Arrow')], [A('Delete', 'Arrow'), sfx('grace')]),
    ]),
    group('Języki ognia (flames around the angel)', [
      ev([cmp(lvl('ogien'), '>', '0')], [
        A('SetXY', 'FlameRing', '=', `${PX} + cos(ToRad(TimeFromStart() * 140 + FlameRing.Index * 360 / SceneInstancesCount(FlameRing))) * (St.ogienR - 30)`, '=', `${PY} + sin(ToRad(TimeFromStart() * 140 + FlameRing.Index * 360 / SceneInstancesCount(FlameRing))) * (St.ogienR - 30)`),
        set('Tm.ogien', '-', dt),
      ]),
      ev([cmp(lvl('ogien'), '>', '0'), cmp('Tm.ogien', '<=', '0'), playing()], [set('Tm.ogien', '=', 'St.ogienTick')], [
        ev([C('Distance', 'Traumas', 'Player', 'St.ogienR')], [oset('Traumas', 'Hp', '-', 'St.ogienDmg * Traumas.Armor'), oset('Traumas', 'HitT', '=', '0.5')]),
      ]),
    ]),
    group('Gwałtowny wicher (wind)', [
      ev([cmp(lvl('wicher'), '>', '0'), playing()], [set('Tm.wicher', '-', dt)]),
      ev([cmp(lvl('wicher'), '>', '0'), cmp('Tm.wicher', '<=', '0'), playing()], [
        set('Tm.wicher', '=', 'St.wicherT'), sfx('grace'),
        A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', 'St.wicherR'), oset('Shockwave', 'Life', '=', '0.45'),
      ], [
        ev([C('Distance', 'Traumas', 'Player', 'St.wicherR')], [...knockFrom(PX, PY, '1000', '0.35'), oset('Traumas', 'Hp', '-', 'St.wicherDmg * Traumas.Armor')]),
      ]),
    ]),
    group('Gołębica (the dove)', [
      ev([cmp(lvl('golebica'), '>', '0'), playing()], [set('Tm.golebica', '-', dt)]),
      ev([oisS('Dove', 'State', '=', q('orbit'))], [
        A('SetXY', 'Dove', '=', `lerp(Dove.X(), ${PX} + cos(ToRad(TimeFromStart() * 80)) * 90, min(1, 6 * ${dt}))`, '=', `lerp(Dove.Y(), ${PY} + sin(ToRad(TimeFromStart() * 80)) * 90, min(1, 6 * ${dt}))`),
        setZ('Dove', '110'),
        A('SetAngle', 'Dove', '=', 'TimeFromStart() * 80 + 90'),
      ]),
      ev([oisS('Dove', 'State', '=', q('orbit')), cmp('Tm.golebica', '<=', '0'), playing(), C('Distance', 'Traumas', 'Dove', '650'), C('PickNearest', 'Traumas', 'Dove.X()', 'Dove.Y()')], [
        set('Tm.golebica', '=', 'St.doveCd'),
        osetS('Dove', 'State', '=', q('dive')), oset('Dove', 'T', '=', '0'),
        oset('Dove', 'TX', '=', 'Traumas.X()'), oset('Dove', 'TY', '=', 'Traumas.Y()'),
        A('RotateTowardPosition', 'Dove', 'Traumas.X()', 'Traumas.Y()', '0'),
      ]),
      ev([oisS('Dove', 'State', '=', q('dive'))], [
        oset('Dove', 'T', '+', dt),
        A('SetXY', 'Dove', '=', `lerp(Dove.X(), Dove.TX, min(1, 14 * ${dt}))`, '=', `lerp(Dove.Y(), Dove.TY, min(1, 14 * ${dt}))`),
        setZ('Dove', 'lerp(Dove.Object3D::Z(), 30, min(1, 14 * TimeDelta()))'),
      ], [
        ev([ois('Dove', 'T', '>=', '0.22')], [osetS('Dove', 'State', '=', q('orbit')), ...particle('HitSpark', 'Dove.TX', 'Dove.TY', '30')], [
          ev([C('Distance', 'Traumas', 'Dove', '95')], [oset('Traumas', 'Hp', '-', 'St.doveDmg * Traumas.Armor'), oset('Traumas', 'Stun', '=', '0.3'), oset('Traumas', 'HitT', '=', '1')]),
        ]),
      ]),
    ]),
    group('Ogień Eliasza (fire from heaven)', [
      ev([cmp(lvl('eliasz'), '>', '0'), playing()], [set('Tm.eliasz', '-', dt)]),
      ev([cmp(lvl('eliasz'), '>', '0'), cmp('Tm.eliasz', '<=', '0'), playing()], [set('Tm.eliasz', '=', 'St.eliaszT')], [
        repeat('St.eliaszN', [], [], [
          ev([C('Distance', 'Traumas', 'Player', '760'), C('PickRandomInstance', 'Traumas')], [
            A('Create', 'FirePillar', 'Traumas.X()', 'Traumas.Y()', '""'),
            setZ('FirePillar', '420'),
            oset('FirePillar', 'Radius', '=', 'St.eliaszR'), oset('FirePillar', 'Damage', '=', 'St.eliaszDmg'),
            A('Tween::AddObjectPositionZTween2', 'FirePillar', 'Tween', 'Object3D', q('fall'), '0', q('easeInQuad'), '0.25', 'no'),
          ]),
        ]),
      ]),
      ev([], [oset('FirePillar', 'T', '+', dt)]),
      forEach('FirePillar', [ois('FirePillar', 'T', '>=', '0.25'), oisB('FirePillar', 'Hit', false)], [
        osetB('FirePillar', 'Hit', true), sfx('fire'), shake('0.15'),
        ...particle('BurstFire', 'FirePillar.X()', 'FirePillar.Y()', '20'),
      ], [
        ev([C('Distance', 'Traumas', 'FirePillar', 'FirePillar.Radius')], [oset('Traumas', 'Hp', '-', 'FirePillar.Damage * Traumas.Armor'), oset('Traumas', 'HitT', '=', '1')]),
      ]),
      ev([ois('FirePillar', 'T', '>', '0.75')], [A('Delete', 'FirePillar')]),
    ]),
    group('Trąby Jerycha (trumpets)', [
      ev([cmp(lvl('jerycho'), '>', '0'), playing()], [set('Tm.jerycho', '-', dt)]),
      ev([cmp(lvl('jerycho'), '>', '0'), cmp('Tm.jerycho', '<=', '0'), playing()], [
        set('Tm.jerycho', '=', 'St.jerT'), sfx('door'), shake('0.2'),
        A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '540'), oset('Shockwave', 'Life', '=', '0.6'),
      ], [
        ev([C('Distance', 'Traumas', 'Player', '540')], [oset('Traumas', 'Stun', '=', 'max(Traumas.Stun, St.jerStun)'), oset('Traumas', 'Hp', '-', 'St.jerDmg * Traumas.Armor')]),
        ev([C('Distance', 'Arrow', 'Player', '540')], [A('Delete', 'Arrow')]),
      ]),
    ]),
    group('Proca Dawida (the sling)', [
      comment('The stone always flies at the strongest shadow in range (the one with the most strength left).'),
      ev([cmp(lvl('dawid'), '>', '0'), playing(), C('FireBullet::FireBullet::IsReadyToShoot', 'Player', 'SlingGun')], [set('Best', '=', '0')], [
        forEach('Targets', [C('Distance', 'Targets', 'Player', '820'), ois('Targets', 'Hp', '>', 'Best'), ois('Targets', 'Armor', '>', '0')], [set('Best', '=', 'Targets.Hp'), set('BestX', '=', 'Targets.X()'), set('BestY', '=', 'Targets.Y()')]),
        ev([cmp('Best', '>', '0')], [
          A('FireBullet::FireBullet::FireTowardPosition', 'Player', 'SlingGun', PX, PY, 'Stone', 'BestX', 'BestY', '1150'),
          oset('Stone', 'Damage', '=', 'St.slingDmg'),
          oset('Stone', 'Pierce', '=', 'St.slingPierce'),
          oset('Stone', 'Life', '=', '2'),
          setZ('Stone', '40'),
        ]),
      ]),
    ]),
  ]);
}

// ─── the shadow-thoughts ───────────────────────────────────────────────────────────────────────

function traumaEvents() {
  const T = 'Traumas';
  const free = [playing(), ois(T, 'KnockT', '<=', '0'), ois(T, 'Stun', '<=', '0')];
  const toward = speed => A('AddForceTowardPosition', T, PX, PY, speed, '0');
  const angleTo = `${T}.AngleToPosition(${PX}, ${PY})`;
  const dist = `${T}.DistanceToPosition(${PX}, ${PY})`;
  const arche = name => oisS(T, 'Archetype', '=', q(name));
  return group('Shadow-thoughts', [
    comment('Each shadow moves by its archetype (Content.enemies): chase, circle, charge, drift, tank, split, blink, ranged, gentle. Slowed shadows (incense, prayer, balm) move at SpeedNow.'),
    ev([playing()], [
      oset('Targets', 'Stun', '-', dt), oset('Targets', 'KnockT', '-', dt), oset('Targets', 'HitCD', '-', dt), oset('Targets', 'ShieldCD', '-', dt),
      oset('Targets', 'HitT', '=', `max(0, Targets.HitT - 6 * ${dt})`),
      oset(T, 'T', '+', dt), oset(T, 'FireCD', '-', dt), oset(T, 'SlowT', '-', dt),
    ]),
    ev([ois(T, 'SlowT', '<=', '0')], [oset(T, 'Slow', '=', '0')]),
    ev([], [oset(T, 'SpeedNow', '=', `${T}.Speed * (1 - ${T}.Slow)`)]),
    comment('Burning (Uriel\'s flame): strength drains while the fire lasts.'),
    ev([playing(), ois('Targets', 'BurnT', '>', '0')], [oset('Targets', 'BurnT', '-', dt), oset('Targets', 'Hp', '-', `Targets.BurnDps * Targets.Armor * ${dt}`)]),
    comment('A hit squashes the painting for a moment.'),
    ev([], [A('Scene3D::Model3DObject::SetScaleX', T, '=', `${T}.BaseScale * (1 + 0.16 * ${T}.HitT)`), A('Scene3D::Model3DObject::SetScaleZ', T, '=', `${T}.BaseScale * (1 - 0.12 * ${T}.HitT)`)]),
    ev([playing(), ois(T, 'KnockT', '>', '0')], [A('AddForceAL', T, `${T}.KnockA`, `${T}.KnockS`, '0')]),
    ev([...free, OR(arche('chase'), arche('tank'), arche('split'), arche('blink'))], [toward(`${T}.SpeedNow`)]),
    comment('Circle: orbit for a while, then strike.'),
    ev([...free, arche('circle')], [], [
      ev([ois(T, 'T', '<', '2.6')], [A('AddForceAL', T, `${angleTo} + 72 * ${T}.Dir`, `${T}.SpeedNow`, '0')]),
      ev([ois(T, 'T', '>=', '2.6')], [toward(`${T}.SpeedNow * 1.8`)]),
      ev([ois(T, 'T', '>=', '3.9')], [oset(T, 'T', '=', '0'), oset(T, 'Dir', '*', '-1')]),
    ]),
    comment('Charge: walk, wind up (a moment to strike it first!), dash.'),
    ev([...free, arche('charge')], [], [
      ev([oisS(T, 'State', '=', q('walk'))], [toward(`${T}.SpeedNow * 0.6`)]),
      ev([oisS(T, 'State', '=', q('walk')), ois(T, 'T', '>', '2.2'), cmp(dist, '<', '460')], [osetS(T, 'State', '=', q('wind')), oset(T, 'T', '=', '0'), oset(T, 'ChargeA', '=', angleTo)]),
      ev([oisS(T, 'State', '=', q('wind')), ois(T, 'T', '>', '0.6')], [osetS(T, 'State', '=', q('dash')), oset(T, 'T', '=', '0')]),
      ev([oisS(T, 'State', '=', q('dash'))], [A('AddForceAL', T, `${T}.ChargeA`, `${T}.SpeedNow * 3.4`, '0')]),
      ev([oisS(T, 'State', '=', q('dash')), ois(T, 'T', '>', '0.5')], [osetS(T, 'State', '=', q('walk')), oset(T, 'T', '=', '0')]),
    ]),
    comment('Drift: come close, then hover sideways; loneliness and shame keep their distance.'),
    ev([...free, OR(arche('drift'), arche('gentle'))], [], [
      ev([cmp(dist, '>', '260')], [toward(`${T}.SpeedNow`)]),
      ev([cmp(dist, '<=', '260')], [A('AddForceAL', T, `${angleTo} + 90 * ${T}.Dir`, `${T}.SpeedNow * 0.7`, '0')]),
      ev([ois(T, 'T', '>', '3')], [oset(T, 'T', '=', '0'), oset(T, 'Dir', '*', '-1')]),
    ]),
    comment('Blink: anxiety and doubt vanish and reappear somewhere near.'),
    ev([...free, arche('blink'), ois(T, 'T', '>', '3.2')], [], [
      forEach(T, [], [
        ...particle('BurstShadow', `${T}.X()`, `${T}.Y()`, '30'),
        A('PutAroundPosition', T, PX, PY, 'RandomFloatInRange(230, 330)', 'RandomFloatInRange(0, 360)'),
        oset(T, 'T', '=', '0'),
      ]),
    ]),
    comment('Ranged: the Accuser keeps away and throws fiery arrows (Ef 6,16).'),
    ev([...free, arche('ranged')], [], [
      ev([cmp(dist, '>', '520')], [toward(`${T}.SpeedNow`)]),
      ev([cmp(dist, '<', '360')], [A('AddForceAL', T, `${angleTo} + 180`, `${T}.SpeedNow`, '0')]),
      ev([cmp(dist, '>=', '360'), cmp(dist, '<=', '520')], [A('AddForceAL', T, `${angleTo} + 90 * ${T}.Dir`, `${T}.SpeedNow * 0.5`, '0')]),
      forEach(T, [ois(T, 'FireCD', '<=', '0'), cmp(dist, '<', '760')], [
        oset(T, 'FireCD', '=', 'RandomFloatInRange(2.2, 3)'),
        A('Create', 'Arrow', `${T}.X()`, `${T}.Y()`, '""'),
        setZ('Arrow', '45'),
        A('SetAngle', 'Arrow', '=', `${T}.AngleToPosition(${PX}, ${PY})`),
        A('AddForceAL', 'Arrow', 'Arrow.Angle()', 'Tuning.bossArrowSpeed', '1'),
      ]),
    ]),
    comment('Grief is not an enemy: weapons pass through it. Standing still beside it, the angel keeps it company until it turns into light.'),
    ev([playing(), arche('gentle'), cmp('Still', '>=', '0.3'), C('Distance', T, 'Player', '260')], [oset(T, 'Hp', '-', `${T}.MaxHp * 0.3 * ${dt}`), oset(T, 'HitT', '=', '0.3')]),
    ev([playing()], [A('SeparateFromObjects', T, T), A('SeparateFromObjects', T, 'PropsAll')]),
    ev([cmp(`${T}.DistanceToPosition(0, 0)`, '>', `${R} - 40`)], [A('AddForceTowardPosition', T, '0', '0', '400', '0')]),
    comment('Touching a shadow wounds the angel (unless grace still protects it); grief only weighs.'),
    ev([playing(), C('CollisionNP', 'Player', T), NOT(arche('gentle')), cmp('Invuln', '<=', '0')], [
      setB('HurtNow', true),
      oset(T, 'KnockT', '=', '0.3'), oset(T, 'KnockA', '=', `${angleTo} + 180`), oset(T, 'KnockS', '=', '700'),
    ]),
    ev([playing(), C('CollisionNP', 'Player', T), arche('gentle')], [set('Heavy', '=', '0.3')]),
    group('Thoughts over strong shadows', [
      comment('A strong shadow carries its thought in words above it, so it can be recognised.'),
      forEach('UiSmall', [oisS('UiSmall', 'Key', '=', q('thought'))], [setB('found', false)], [
        ev([ois(T, 'Uid', '=', 'UiSmall.Arg')], [
          A('SetXY', 'UiSmall', '=', `HolyHoly::ScreenX(${T}.X(), ${T}.Y(), 230) - UiSmall.Width() / 2`, '=', `HolyHoly::ScreenY(${T}.X(), ${T}.Y(), 230)`),
          setB('found', true),
        ]),
        ev([isB('found', false)], [A('Delete', 'UiSmall')]),
      ], { vars: { found: false } }),
    ]),
    comment('A shadow whose strength is gone breaks: light flies out and a true sentence rises in its place.'),
    forEach(T, [ois(T, 'Hp', '<=', '0'), oisB(T, 'Dying', false)], [
      osetB(T, 'Dying', true),
      set('Run.destroyed', '+', '1'), set('Run.reframes', '+', '1'), set('Save.reframes', '+', '1'),
      setB(`Save.seen[${T}.Kind]`, true),
      set('Prayer', '=', 'min(100, Prayer + Tuning.prayerPerKill * St.prayerMul)'),
      ...particle('BurstShadow', `${T}.X()`, `${T}.Y()`, '30'),
      A('Create', 'Glow', `${T}.X()`, `${T}.Y()`, '""'), setZ('Glow', '6'),
      set('Chain', '+', '1'), set('ChainT', '=', '1.4'),
      sfx('digest', 'Chain', `clamp((${T}.X() - CameraCenterX("")) / 600, -1, 1)`),
    ], [
      repeat(`${T}.Value`, [], [
        A('Create', 'LightShard', `${T}.X() + RandomFloatInRange(-30, 30)`, `${T}.Y() + RandomFloatInRange(-30, 30)`, '""'),
        A('AddForceAL', 'LightShard', 'RandomFloatInRange(0, 360)', '160', '0.6'),
      ]),
      ev([oisB(T, 'Voice', true)], [
        set('SilT', '=', '0'), set('Run.voices', '+', '1'), set('Prayer', '=', 'min(100, Prayer + 15)'),
        A('Create', 'Truth', `${T}.X()`, `${T}.Y()`, '""'), setZ('Truth', '40'), A('AddForceAL', 'Truth', 'RandomFloatInRange(0, 360)', '120', '0.5'),
        ...particle('BurstLight', `${T}.X()`, `${T}.Y()`, '80'), shake('0.25'),
      ]),
      ev([NOT(oisB(T, 'Voice', true)), OR(oisB(T, 'Elite', true), AND(cmp('AffT', '<=', '0'), cmp('SceneInstancesCount(UiText)', '<', '30')))], [set('AffT', '=', 'Tuning.affirmGap'), set('w', '=', 'RandomFloat(1)')], [
        ev([OR(oisB(T, 'Elite', true), cmp('w', '<', '0.22'))], [
          label('UiText', `HolyHoly::ScreenX(${T}.X(), ${T}.Y(), 120) - 210`, `HolyHoly::ScreenY(${T}.X(), ${T}.Y(), 120) - 24`, 420, '', { align: 'center', key: 'truth', expr: `HolyHoly::AngelWord(${T}.Kind)` }),
          A('TextObject::ChangeColor', 'UiText', q('255;214;120')),
          A('TextObject::Text::SetFontSize', 'UiText', '=', '32'),
        ]),
        ev([NOT(oisB(T, 'Elite', true)), cmp('w', '>=', '0.22')], [
          label('UiText', `HolyHoly::ScreenX(${T}.X(), ${T}.Y(), 120) - 190`, `HolyHoly::ScreenY(${T}.X(), ${T}.Y(), 120) - 20`, 380, '', { align: 'center', key: 'truth', expr: `HolyHoly::Reframe(${T}.Kind)` }),
          A('TextObject::ChangeColor', 'UiText', q('250;244;228')),
        ]),
        ev([oisS('UiText', 'Key', '=', q('truth')), ois('UiText', 'Index', '=', '0')], [
          oset('UiText', 'Index', '=', '1'),
          A('SetZOrder', 'UiText', '=', '20'),
          A('TextObject::Text::SetOutlineEnabled', 'UiText', 'yes'),
          A('TextObject::Text::SetOutlineColor', 'UiText', q('30;20;40')),
          tweenPos('UiText', 'rise', 'UiText.X()', 'UiText.Y() - 70', '2.2'),
          tweenOpacity('UiText', 'fade', '0', '2.2', 'easeInQuad', true),
        ]),
      ], { vars: { w: 0 } }),
      ev([oisB(T, 'Elite', true)], [A('Create', 'Reliquary', `${T}.X()`, `${T}.Y()`, '""'), ...banner(q('Relikwiarz! Podnieś go'), 1.2)]),
      ev([hero('barachiel'), cmp('RandomFloat(1)', '<', '0.06'), noEvo('sig-barachiel')], [A('Create', 'Manna', `${T}.X()`, `${T}.Y()`, '""')]),
      ev([hero('barachiel'), cmp('RandomFloat(1)', '<', '0.12'), evo('sig-barachiel')], [A('Create', 'Manna', `${T}.X()`, `${T}.Y()`, '""')]),
      ev([arche('split'), oisB(T, 'Small', false)], [], [
        repeat('2', [], [], [
          ev([], [
            A('CreateByName', T, `"Enemy_" + ${T}.Kind`, `${T}.X() + RandomFloatInRange(-40, 40)`, `${T}.Y() + RandomFloatInRange(-40, 40)`, '""'),
          ], [ev([], [
            osetS(T, 'Kind', '=', q('nalog')), osetS(T, 'Archetype', '=', q('split')), osetB(T, 'Small', true),
            oset(T, 'MaxHp', '=', 'Content.enemies.nalog.hp * 0.5 * St.hpMul'), oset(T, 'Hp', '=', `${T}.MaxHp`),
            oset(T, 'Speed', '=', 'Content.enemies.nalog.speed * Tuning.traumaSpeed * 1.2'),
            oset(T, 'Value', '=', '1'), oset(T, 'Armor', '=', '1'), oset(T, 'PunchMul', '=', '1'), oset(T, 'Dir', '=', 'RandomWithStep(-1, 1, 2)'),
            oset(T, 'BaseScale', '=', '0.65'), scale(T, '0.65'),
          ])]),
        ]),
      ]),
      ev([], [A('Delete', T)]),
    ]),
    ev([], [set('AffT', '-', dt)]),
    ev([cmp('ChainT', '>', '0')], [set('ChainT', '-', dt)], [ev([cmp('ChainT', '<=', '0')], [set('Chain', '=', '0')])]),
    group('Arrows', [
      ev([C('CollisionNP', 'Arrow', 'Player'), cmp('Invuln', '<=', '0'), playing()], [setB('HurtNow', true), A('Delete', 'Arrow')]),
      ev([NOT(C('Distance', 'Arrow', 'Player', '1500'))], [A('Delete', 'Arrow')]),
    ]),
  ]);
}

// ─── light, manna, reliquaries ─────────────────────────────────────────────────────────────────

function pickupEvents() {
  const cx = 'SceneWindowWidth() / 2';
  return group('Light, manna and reliquaries', [
    ev([C('Distance', 'LightShard', 'Player', 'St.magnet')], [osetB('LightShard', 'Pull', true)]),
    ev([OR(isS('State', '=', q('sabbath')), isS('State', '=', q('bossDown')), isS('State', '=', q('praise')))], [osetB('LightShard', 'Pull', true)]),
    ev([oisB('LightShard', 'Pull', true)], [A('AddForceTowardPosition', 'LightShard', PX, PY, 'Tuning.shardSpeed', '0')]),
    ev([C('CollisionNP', 'LightShard', 'Player')], [
      set('Xp', '+', 'LightShard.Value * St.lightMul * (1 + 0.05 * min(Combo, 20))'),
      set('Run.light', '+', 'LightShard.Value * St.lightMul * (1 + 0.05 * min(Combo, 20))'),
      A('Delete', 'LightShard'),
    ], [ev([cmp('SeedT', '<=', '0')], [set('SeedT', '=', '0.06'), sfx('seed', 'mod(Run.destroyed, 8)')])]),
    ev([], [set('SeedT', '-', dt)]),
    ev([C('CollisionNP', 'Manna', 'Player')], [set('Hearts', '=', 'min(MaxHearts, Hearts + 1)'), A('Delete', 'Manna'), sfx('grace'), ...banner(q('Manna: +1 serce'), 1.2)]),
    comment('Reliquary (left by a strong shadow): one gift at once, an evolution first if one is ready.'),
    ev([C('CollisionNP', 'Reliquary', 'Player'), playing()], [A('Delete', 'Reliquary'), A('HolyHoly::DrawChoices', '1'), sfx('rank'), shake('0.2')], [
      ev([cmp('VariableChildCount(Run.choices)', '=', '0')], [set('Hearts', '=', 'min(MaxHearts, Hearts + 1)'), set('Run.light', '+', '20'), set('Xp', '+', '20'), ...banner(q('Relikwiarz: +1 serce i światło'), 1.6)]),
      ev([cmp('VariableChildCount(Run.choices)', '>', '0')], [setB('StatsDirty', true), set('RelicT', '=', '2.2')], [
        ev([isB('Run.choices[0].evolve', true)], [
          A('HolyHoly::TakeSkill', 'Run.choices[0].id', 'yes'),
          ...banner('"Ewolucja! " + Content.skills[Run.choices[0].id].evolution.name', 2.4),
        ]),
        ev([isB('Run.choices[0].evolve', false)], [
          A('HolyHoly::TakeSkill', 'Run.choices[0].id', 'no'),
          ...banner('"Relikwiarz: " + Content.skills[Run.choices[0].id].name', 2),
        ]),
        ev([cmpS('Run.choices[0].id', '=', q('manna'))], [set('Hearts', '=', `min(MaxHearts, Hearts + 1 + ${step(G('manna'), 3)})`)]),
        ev([cmpS('Run.choices[0].id', '=', q('serce'))], [set('Hearts', '+', '1')]),
        ev([], [], closePanel('relic')),
        ev([], [
          A('Create', 'UiArt', cx, 'SceneWindowHeight() / 2 - 40', q('UI')), animE('UiArt', 'HolyHoly::SkillIcon(Run.choices[0].id)'),
          size('UiArt', '150', '150'), osetS('UiArt', 'Panel', '=', q('relic')), A('SetZOrder', 'UiArt', '=', '60'),
          scale('UiArt', '0.2'), A('Tween::TweenBehavior::AddObjectScaleTween3', 'UiArt', 'Tween', q('pop'), '1', q('easeOutBack'), '0.35', 'no', 'yes'),
        ]),
      ]),
    ]),
    ev([cmp('RelicT', '>', '0')], [set('RelicT', '-', `${dt} / max(0.1, TimeScale())`)], [
      ev([cmp('RelicT', '<=', '0')], [], closePanel('relic')),
      ev([cmp('RelicT', '<', '0.5'), oisS('UiArt', 'Panel', '=', q('relic'))], [opacity('UiArt', '255 * RelicT * 2')]),
    ]),
  ]);
}

// ─── level up: gifts and virtues, with evolutions ─────────────────────────────────────────────

function levelUpEvents() {
  const cx = 'SceneWindowWidth() / 2';
  const S = 'Content.skills[id]';
  return group('Gifts at each level', [
    comment('Each level pauses the fight and offers up to three cards (HolyHoly::DrawChoices): gifts (weapons) and virtues, four slots of each. A gift at its last level with its paired virtue evolves: that golden card comes first. A short delay keeps a running key press from picking blindly. Rerolls and "let it go" (one heart) give control over the pool.'),
    ev([playing(), cmp('Xp', '>=', 'XpNext')], [
      set('Xp', '-', 'XpNext'), set('Level', '+', '1'), set('Run.level', '=', 'Level'),
      set('XpNext', '=', 'round(XpNext * Tuning.xpGrowth + Tuning.xpAdd)'),
      setS('State', '=', q('levelup')), setS('Ui.top', '=', q('levelup')), set('LevelT', '=', '0'),
      A('ChangeLayerTimeScale', '""', '0'),
      sfx('levelup'),
      setB('LevelBuild', true),
    ]),
    ev([isS('State', '=', q('levelup'))], [set('LevelT', '+', dt)]),
    ev([isB('LevelBuild', true)], [setB('LevelBuild', false), A('HolyHoly::DrawChoices', '3')], [
      ...closePanel('levelup'),
      ev([cmp('VariableChildCount(Run.choices)', '=', '0')], [
        setS('State', '=', q('play')), setS('Ui.top', '=', '""'), A('ChangeLayerTimeScale', '""', '1'),
        set('Hearts', '=', 'MaxHearts'), set('Prayer', '=', 'min(100, Prayer + 30)'),
        ...banner(q('Wszystkie dary pełne: łaska odnawia serca'), 1.6),
      ]),
      ev([cmp('VariableChildCount(Run.choices)', '>', '0')], [
        // the panel and its three cards narrow with the screen (16:10 and 4:3 too)
        set('pw', '=', 'min(1200, SceneWindowWidth() - 40)'), set('cw', '=', '(pw - 60) / 3'),
        box(`${cx} - pw / 2`, '60', 'pw', '610', { panel: 'levelup' }),
        label('UiTitle', `${cx} - pw / 2`, '76', 'pw', '', { panel: 'levelup', align: 'center', h: 52, expr: '"Poziom " + ToString(Level) + " · nowy dar"' }),
        label('UiSmall', `${cx} - pw / 2`, '130', 'pw', 'Wybierz jeden: klawisze 1, 2, 3 albo kliknięcie', { panel: 'levelup', align: 'center', h: 26 }),
        button(`${cx} - 330`, '600', '300', '52', '', 'reroll', { panel: 'levelup', captionExpr: '"Losuj ponownie (" + ToString(Rerolls) + ")"' }),
        button(`${cx} + 30`, '600', '300', '52', 'Odpuść (+1 serce)', 'skipGift', { panel: 'levelup' }),
      ], [
        repeat('VariableChildCount(Run.choices)', [], [
          setS('id', '=', 'Run.choices[c].id'),
          set('x', '=', `${cx} - pw / 2 + 22 + c * (cw + 8)`),
          set('lvl', '=', 'Run.gifts[id]'), set('fb', '=', '522'),
          A('HolyHoly::MakePanel', 'UiCard', 'x', '160', 'cw', '425', '"card" + ToString(c)', q('levelup'), q('UI')),
          // each creation gets its own sub-event (DSL): everything about the icon is set here, where it is the picked one
          A('Create', 'UiArt', 'x + cw / 2', '268', q('UI')), animE('UiArt', 'HolyHoly::ChoiceIcon(c)'), size('UiArt', '128', '128'), osetS('UiArt', 'Panel', '=', q('levelup')), A('SetZOrder', 'UiArt', '=', '290'),
          button('x + (cw - min(250, cw - 30)) / 2', '530', 'min(250, cw - 30)', '46', '', 'pick', { arg: 'c', panel: 'levelup', captionExpr: '"Wybierz (" + ToString(c + 1) + ")"' }),
        ], [
          comment('The card\'s lines flow one under another (fy: the bottom of the last one) and shrink to fit above the button.'),
          ev([isB('Run.choices[c].evolve', true)], [
            label('UiLabel', 'x + 16', '166', 'cw - 32', 'EWOLUCJA', { panel: 'levelup', align: 'center', key: 'cardKind', h: 30 }),
            label('UiText', 'x + 16', '338', 'cw - 32', '', { panel: 'levelup', align: 'center', h: 64, expr: `${S}.evolution.name` }),
            set('fy', '=', 'UiText.Y() + UiText.Height() + 4'),
            label('UiSmall', 'x + 22', 'fy', 'cw - 44', '', { panel: 'levelup', align: 'center', h: '(522 - fy) * 0.55', expr: `${S}.evolution.text` }),
            set('fy', '=', 'UiSmall.Y() + UiSmall.Height() + 6'),
            label('UiSmall', 'x + 22', 'fy', 'cw - 44', '', { panel: 'levelup', align: 'center', h: '522 - fy', expr: `"„" + HolyHoly::G(${S}.evolution.verse.text) + "” (" + HolyHoly::G(${S}.evolution.verse.ref) + ")"` }),
          ]),
          ev([isB('Run.choices[c].evolve', false)], [
            label('UiText', 'x + 16', '338', 'cw - 32', '', { panel: 'levelup', align: 'center', h: 64, expr: `${S}.name + "  " + HolyHoly::PipsText(lvl + 1, ${S}.maxLevel)` }),
            set('fy', '=', 'UiText.Y() + UiText.Height() + 2'),
            label('UiSmall', 'x + 22', 'fy', 'cw - 44', '', { panel: 'levelup', align: 'center', h: 52, expr: `${S}.levels[lvl]` }),
            A('TextObject::ChangeColor', 'UiSmall', q('255;226;150')),
            set('fy', '=', 'UiSmall.Y() + UiSmall.Height() + 6'),
          ], [
            ev([cmpS(`${S}.evolution.with`, '!=', '""')], [
              label('UiSmall', 'x + 22', '496', 'cw - 44', '', { panel: 'levelup', align: 'center', h: 26, expr: `"Ewoluuje z cnotą: " + Content.skills[${S}.evolution.with].name` }),
              set('fb', '=', 'UiSmall.Y() - 4'),
            ]),
            ev([], [label('UiSmall', 'x + 22', 'fy', 'cw - 44', '', { panel: 'levelup', align: 'center', h: 'fb - fy', expr: `${S}.description` })]),
            ev([cmpS(`${S}.kind`, '=', q('virtue'))], [label('UiLabel', 'x + 16', '166', 'cw - 32', 'Cnota', { panel: 'levelup', align: 'center', key: 'cardKind', h: 30 })]),
            ev([cmpS(`${S}.kind`, '=', q('weapon'))], [label('UiLabel', 'x + 16', '166', 'cw - 32', 'Dar', { panel: 'levelup', align: 'center', key: 'cardKind', h: 30 })]),
            ev([cmpS(`${S}.kind`, '=', q('signature'))], [label('UiLabel', 'x + 16', '166', 'cw - 32', 'Dar archanioła', { panel: 'levelup', align: 'center', key: 'cardKind', h: 30 })]),
          ]),
          ev([oisS('UiLabel', 'Key', '=', q('cardKind'))], [A('TextObject::ChangeColor', 'UiLabel', q('255;214;120'))]),
          ev([isB('Run.choices[c].evolve', true), oisS('UiCard', 'Key', '=', '"card" + ToString(c)')], [tint('UiCard', q('255;214;120'))]),
        ], { index: 'c', vars: { c: 0, x: 0, lvl: 0, id: '', fy: 0, fb: 522 } }),
      ], { vars: { pw: 1200, cw: 380 } }),
    ]),
    ev([isS('State', '=', q('levelup')), keyJust('Num1')], [setS('Ui.clicked', '=', q('pick')), set('Ui.arg', '=', '0')]),
    ev([isS('State', '=', q('levelup')), keyJust('Num2'), cmp('VariableChildCount(Run.choices)', '>=', '2')], [setS('Ui.clicked', '=', q('pick')), set('Ui.arg', '=', '1')]),
    ev([isS('State', '=', q('levelup')), keyJust('Num3'), cmp('VariableChildCount(Run.choices)', '>=', '3')], [setS('Ui.clicked', '=', q('pick')), set('Ui.arg', '=', '2')]),
    ev([isS('State', '=', q('levelup')), clicked('reroll'), cmp('Rerolls', '>', '0')], [set('Rerolls', '-', '1'), setB('LevelBuild', true), sfx('click')]),
    ev([isS('State', '=', q('levelup')), clicked('skipGift')], [set('Hearts', '=', 'min(MaxHearts, Hearts + 1)'), setS('Ui.clicked', '=', q('resumeLevel'))]),
    ev([isS('State', '=', q('levelup')), clicked('pick'), cmp('LevelT', '>', '0.35')], [setS('gid', '=', 'Run.choices[Ui.arg].id'), sfx('rank'), setB('StatsDirty', true)], [
      ev([isB('Run.choices[Ui.arg].evolve', true)], [A('HolyHoly::TakeSkill', 'gid', 'yes'), ...banner('"Ewolucja! " + Content.skills[gid].evolution.name', 2.4), sfx('revelation', '2')]),
      ev([isB('Run.choices[Ui.arg].evolve', false)], [A('HolyHoly::TakeSkill', 'gid', 'no')]),
      ev([isS('gid', '=', q('manna'))], [set('Hearts', '=', `min(MaxHearts, Hearts + 1 + ${step(G('manna'), 3)})`)]),
      ev([isS('gid', '=', q('serce'))], [set('Hearts', '+', '1')]),
      ev([], [setS('Ui.clicked', '=', q('resumeLevel'))]),
    ], { vars: { gid: '' } }),
    ev([isS('State', '=', q('levelup')), clicked('resumeLevel')], [
      setS('State', '=', q('play')), setS('Ui.top', '=', '""'),
      A('ChangeLayerTimeScale', '""', '1'),
    ], closePanel('levelup')),
  ]);
}

// ─── stages: one day or night of the person, and the rest between them ─────────────────────────

function spawn(x, y, kindExpr, extra = []) {
  const T = 'Traumas';
  return ev([], [
    setS('kind', '=', kindExpr),
    A('CreateByName', T, '"Enemy_" + kind', x, y, '""'),
  ], [ev([], [
    osetS(T, 'Kind', '=', 'kind'),
    osetS(T, 'Archetype', '=', 'Content.enemies[kind].archetype'),
    oset(T, 'MaxHp', '=', 'Content.enemies[kind].hp * (1 + Tuning.chapterHp * Chapter) * (1 + Tuning.stageHp * (min(Stage, StageCount) - 1)) * St.hpMul * Tuning.traumaHpScale * HpMul'),
    oset(T, 'Speed', '=', 'Content.enemies[kind].speed * Tuning.traumaSpeed * (1 + Tuning.chapterSpeed * Chapter)'),
    oset(T, 'Dir', '=', 'RandomWithStep(-1, 1, 2)'),
    oset(T, 'T', '=', 'RandomFloatInRange(0, 2)'),
    oset(T, 'FireCD', '=', 'RandomFloatInRange(1.2, 2.6)'),
    oset(T, 'Armor', '=', '1'), oset(T, 'PunchMul', '=', '1'), oset(T, 'Value', '=', '1'), oset(T, 'BaseScale', '=', '1'),
    setZ(T, '-90'),
    A('Tween::AddObjectPositionZTween2', T, 'Tween', 'Object3D', q('rise'), '0', q('easeOutQuad'), '0.5', 'no'),
  ], [
    ev([oisS(T, 'Archetype', '=', q('tank'))], [oset(T, 'Value', '=', '3')]),
    ev([oisS(T, 'Archetype', '=', q('gentle'))], [oset(T, 'Armor', '=', '0'), oset(T, 'Value', '=', '3')]),
    ev([isB('Save.settings.gentle', true)], [oset(T, 'Speed', '*', '0.85')]),
    ...(extra.length ? [ev([], extra)] : []),
    ev([], [oset(T, 'Hp', '=', `${T}.MaxHp`)]),
  ])], { vars: { kind: '' } });
}

/** A point beyond the edge of the view, inside the map. */
const spawnAround = [
  set('sa', '=', 'RandomFloatInRange(0, 360)'),
  set('sx', '=', `${PX} + cos(ToRad(sa)) * RandomFloatInRange(Tuning.spawnNear, Tuning.spawnFar)`),
  set('sy', '=', `${PY} + sin(ToRad(sa)) * RandomFloatInRange(Tuning.spawnNear, Tuning.spawnFar)`),
  set('sk', '=', `min(1, (${R} - 90) / max(1, sqrt(sx * sx + sy * sy)))`),
  set('sx', '*', 'sk'), set('sy', '*', 'sk'),
];
const stageKind = `${ST}.enemies[RandomInRange(0, VariableChildCount(${ST}.enemies) - 1)]`;
/** Width of the band at the top (stage card, voices): clear of the gift slots on the left and the clock on the right. */
const ZW = 'min(880, SceneWindowWidth() - 524)';
/** Width of the band at the bottom (memories): clear of the prayer button. */
const MW = 'min(920, SceneWindowWidth() - 400)';

function stageEvents() {
  const W = 'SceneWindowWidth()';
  const mod = name => isS(`${ST}.mod`, '=', q(name));
  return group('Stages', [
    comment('A chapter is three stages of one day or night (Content.chapters[].stages): the clock runs from the stage\'s start to its end time, the light and the fog change (evening, dusk, night, small hours, day), each stage has its own shadows, a modifier (swarm: many weak; heavy: fewer, stronger; dark: the fog closes in; voices: the shadows speak more often), a caption that says what is happening, and two memories somewhere on the map. Between stages: the Sabbath and a recognition card.'),
    ev([isB('StageBegin', true)], [
      setB('StageBegin', false), set('Run.stage', '=', 'Stage - 1'), setB('CardNow', true), setB('EliteSpawned', false),
      A('SceneBackground', `${ST}.look.background`),
      A('SetLayerEffectStringParameter', '""', q('Fog'), q('color'), `${ST}.look.fog`),
      A('SetLayerEffectParameter', '""', q('Fog'), q('near'), `${ST}.look.near`),
      A('SetLayerEffectParameter', '""', q('Fog'), q('far'), `${ST}.look.far`),
      A('SetLayerEffectStringParameter', '""', q('Sky'), q('skyColor'), `${ST}.look.sky`),
      A('SetLayerEffectStringParameter', '""', q('Sky'), q('groundColor'), `${ST}.look.ground`),
      A('Scene3D::Cube3DObject::SetTint', 'Floor', `${ST}.look.floor`),
      set('SpawnMul', '=', '1'), set('HpMul', '=', '1'), set('VoiceMul', '=', '1'),
    ], [
      ev([mod('swarm')], [set('SpawnMul', '=', '0.65'), set('HpMul', '=', '0.7')]),
      ev([mod('heavy')], [set('SpawnMul', '=', '1.4'), set('HpMul', '=', '1.6')]),
      ev([mod('voices')], [set('VoiceMul', '=', '0.5'), set('VoiceT', '=', 'min(VoiceT, 8)')]),
      comment('Two memories of this stage: a pale figure of the person, far enough to be looked for.'),
      repeat('2', [], [
        // toward the middle of the map (±100°), so a memory is never pushed back onto the angel at the edge
        set('ma', '=', `AngleBetweenPositions(${PX}, ${PY}, 0, 0) + RandomFloatInRange(-100, 100)`), set('md', '=', 'RandomFloatInRange(900, 1700)'),
        set('mx', '=', `${PX} + cos(ToRad(ma)) * md`), set('my', '=', `${PY} + sin(ToRad(ma)) * md`),
        set('mk', '=', `min(1, (${R} - 250) / max(1, sqrt(mx * mx + my * my)))`),
        set('mx', '*', 'mk'), set('my', '*', 'mk'),
        A('CreateByName', 'Memories', '"Memory_" + Save.profile.gender', 'mx', 'my', '""'),
        oset('Memories', 'Index', '=', 'k'), oset('Memories', 'Stage', '=', 'Stage - 1'), oset('Memories', 'Uid', '=', 'NextUid'),
        A('Create', 'MemoryLight', 'mx', 'my', '""'), setZ('MemoryLight', '4'), oset('MemoryLight', 'Uid', '=', 'NextUid'),
        set('NextUid', '+', '1'),
      ], [], { index: 'k', vars: { k: 0, ma: 0, md: 0, mx: 0, my: 0, mk: 1 } }),
    ]),
    comment('The stage card: the time, the title and what is happening, at the top, while the fight goes on.'),
    ev([isB('CardNow', true), playing()], [setB('CardNow', false), set('CardT', '=', '7.5'), sfx('bell')], [
      ...['stageBack', 'stageTitle', 'stageCaption'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')])),
      ev([], [
        A('Create', 'UiBar', `${W} / 2 - ${ZW} / 2`, '104', q('UI')), osetS('UiBar', 'Key', '=', q('stageBack')), size('UiBar', ZW, '128'), tint('UiBar', q('14;10;24')), opacity('UiBar', '170'), A('SetZOrder', 'UiBar', '=', '55'),
        label('UiTitle', `${W} / 2 - ${ZW} / 2 + 10`, '110', `${ZW} - 20`, '', { key: 'stageTitle', align: 'center', h: 52, expr: `HolyHoly::StageClock(Stage - 1, 0) + " · " + HolyHoly::G(${ST}.title)` }),
        label('UiSmall', `${W} / 2 - ${ZW} / 2 + 20`, '166', `${ZW} - 40`, '', { key: 'stageCaption', align: 'center', h: 60, expr: `HolyHoly::G(${ST}.caption)` }),
      ]),
    ]),
    ev([cmp('CardT', '>', '0')], [set('CardT', '-', dt)], [
      ev([cmp('CardT', '<', '1'), OR(oisS('UiAll', 'Key', '=', q('stageTitle')), oisS('UiAll', 'Key', '=', q('stageCaption')))], [opacity('UiAll', '255 * max(0, CardT)')]),
      ev([cmp('CardT', '<', '1'), oisS('UiBar', 'Key', '=', q('stageBack'))], [opacity('UiBar', '170 * max(0, CardT)')]),
      ev([cmp('CardT', '<=', '0')], [], ['stageBack', 'stageTitle', 'stageCaption'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')]))),
    ]),
    comment('Shadows come from beyond the edge of the view, faster as the stage goes on.'),
    ev([playing(), cmp('Stage', '<=', 'StageCount')], [set('StageTime', '-', dt), set('Run.time', '+', dt), set('SpawnT', '-', dt)]),
    ev([playing(), cmp('Stage', '<=', 'StageCount'), cmp('SpawnT', '<=', '0'), cmp('SceneInstancesCount(Traumas)', '<', 'Tuning.maxAlive')], [
      set('SpawnT', '=', 'max(Tuning.spawnMin, Tuning.spawnInterval * SpawnMul * (1 - 0.16 * (Stage - 1)) * (1 - Tuning.chapterSpawn * Chapter) * (0.55 + 0.45 * StageTime / Tuning.stageSeconds))'),
    ], [
      repeat('1 + floor((Tuning.stageSeconds - StageTime) / 25) + floor((Stage - 1) / 2) + floor(Chapter / 5)', [], [...spawnAround], [
        spawn('sx', 'sy', stageKind),
      ], { vars: { sa: 0, sx: 0, sy: 0, sk: 1 } }),
    ]),
    comment('Halfway through a stage comes one strong shadow: bigger, richer in light, its thought written above it, a reliquary inside.'),
    ev([playing(), cmp('Stage', '<=', 'StageCount'), isB('EliteSpawned', false), cmp('StageTime', '<', 'Tuning.stageSeconds / 2')], [setB('EliteSpawned', true), ...banner(q('Silny cień nadchodzi'), 1.4)], [
      ev([], [...spawnAround], [
        spawn('sx', 'sy', stageKind, [
          oset('Traumas', 'MaxHp', '*', 'Tuning.eliteHp'), osetB('Traumas', 'Elite', true), oset('Traumas', 'Speed', '*', '0.85'), oset('Traumas', 'BaseScale', '=', '1.5'), scale('Traumas', '1.5'),
          oset('Traumas', 'Uid', '=', 'NextUid'), oset('Traumas', 'Value', '=', 'Tuning.eliteValue'), set('NextUid', '+', '1'),
          label('UiSmall', '0', '0', 420, '', { align: 'center', key: 'thought', expr: '"„" + HolyHoly::Thought(Traumas.Kind) + "”"' }),
          oset('UiSmall', 'Arg', '=', 'Traumas.Uid'),
          A('TextObject::ChangeColor', 'UiSmall', q('255;180;190')),
          A('SetZOrder', 'UiSmall', '=', '15'),
        ]),
      ], { vars: { sa: 0, sx: 0, sy: 0, sk: 1 } }),
    ]),
    comment('The end of a stage: the shadows dissolve into light, a heart comes back, and the Sabbath begins.'),
    ev([playing(), cmp('Stage', '<=', 'StageCount'), cmp('StageTime', '<=', '0')], [
      setS('State', '=', q('sabbath')), set('StateT', '=', '0'),
      set('Hearts', '=', 'min(MaxHearts, Hearts + 1)'),
      A('Delete', 'Arrow'),
      sfx('door'),
      ...banner('"Etap " + ToString(Stage) + " za tobą · cisza"', 2),
      setB('Recognized', false),
    ], [
      forEach('Traumas', [], [
        ...particle('BurstShadow', 'Traumas.X()', 'Traumas.Y()', '30'),
        A('Create', 'LightShard', 'Traumas.X()', 'Traumas.Y()', '""'),
        A('Delete', 'Traumas'),
      ]),
    ]),
    ev([isS('State', '=', q('sabbath'))], [set('StateT', '+', dt)], [
      ev([cmp('StateT', '>', '1.2'), isB('Recognized', false), cmp('Stage', '<=', 'StageCount')], [setS('State', '=', q('recognize')), setS('Ui.clicked', '=', q('recogOpen'))]),
      ev([OR(cmp('StateT', '>', '6'), AND(cmp('StateT', '>', '3'), cmp('SceneInstancesCount(LightShard)', '=', '0')))], [
        set('Stage', '+', '1'), set('StageTime', '=', 'Tuning.stageSeconds'), set('SpawnT', '=', '1'),
      ], [
        ev([cmp('Stage', '<=', 'StageCount')], [setS('State', '=', q('play')), setB('StageBegin', true)]),
        ev([cmp('Stage', '>', 'StageCount')], [setS('State', '=', q('bossIntro')), set('StateT', '=', '0')]),
      ]),
    ]),
  ]);
}

// ─── voices: the shadows that speak, and what rises when they are silenced ─────────────────────

function voiceEvents() {
  const T = 'Traumas';
  const W = 'SceneWindowWidth()';
  const V = 'Run.voice';
  const flow = (k, at) => ev([oisS('UiAll', 'Key', '=', q(k)), cmp('SilT', '>=', at), ois('UiAll', 'Index', '=', '0')], [oset('UiAll', 'Index', '=', '1'), tweenOpacity('UiAll', 'in', '255', '0.5')]);
  return group('Voices', [
    comment('Every so often a shadow speaks: a Voice (Content.chapters[].voices, in order) carries one of the person\'s own negative thoughts, said aloud above it. It is bigger, slower and stronger. Silenced, it shows what happened to the thought: it is crossed out, its thinking error is named, what negates it appears, and the true thought rises in gold. It leaves a word of truth that heals.'),
    // an inverted object condition would be true while any other shadow lives: count the voices instead
    ev([], [setB('VoiceAlive', false)]),
    ev([oisB(T, 'Voice', true)], [setB('VoiceAlive', true)]),
    // the gap runs only while no voice speaks, so two silenced voices never come back to back
    ev([playing(), cmp('Stage', '<=', 'StageCount'), isB('VoiceAlive', false)], [set('VoiceT', '-', dt)]),
    ev([playing(), cmp('Stage', '<=', 'StageCount'), cmp('VoiceT', '<=', '0'), isB('VoiceAlive', false)], [
      set('VoiceT', '=', 'Tuning.voiceGap * VoiceMul'),
      A('HolyHoly::DrawVoice', 'VoiceNext'), set('VoiceNext', '+', '1'),
    ], [
      ev([], [...spawnAround], [
        spawn('sx', 'sy', `${V}.kind`, [
          osetB(T, 'Voice', true), oset(T, 'MaxHp', '*', 'Tuning.voiceHp'), oset(T, 'Speed', '*', '0.8'), oset(T, 'BaseScale', '=', '1.35'), scale(T, '1.35'),
          oset(T, 'Uid', '=', 'NextUid'), oset(T, 'Value', '=', 'Tuning.voiceValue'),
          label('UiText', '0', '0', 440, '', { align: 'center', key: 'voiceSays', expr: `"„" + ${V}.says + "”"` }),
          oset('UiText', 'Arg', '=', 'NextUid'),
          A('TextObject::ChangeColor', 'UiText', q('255;170;190')),
          A('TextObject::Text::SetOutlineEnabled', 'UiText', 'yes'), A('TextObject::Text::SetOutlineColor', 'UiText', q('40;10;24')),
          A('SetZOrder', 'UiText', '=', '16'),
          A('Create', 'VoiceRing', 'sx', 'sy', '""'), setZ('VoiceRing', '5'), oset('VoiceRing', 'Uid', '=', 'NextUid'),
          set('NextUid', '+', '1'),
        ]),
      ], { vars: { sa: 0, sx: 0, sy: 0, sk: 1 } }),
      ev([], [sfx('weaken'), set('VoiceLineT', '=', '5')]),
      comment('Wherever it is, the voice is heard: its words at the top of the screen for a few seconds.'),
      // a voice is louder than the stage card: the card makes room for it
      ...['voiceBack', 'voiceLine', 'stageBack', 'stageTitle', 'stageCaption'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')])),
      ev([], [set('CardT', '=', '-1')]),
      ev([cmp('SilT', '<', '0')], [
        A('Create', 'UiBar', `${W} / 2 - ${ZW} / 2`, '104', q('UI')), osetS('UiBar', 'Key', '=', q('voiceBack')), size('UiBar', ZW, '64'), tint('UiBar', q('30;8;20')), opacity('UiBar', '170'), A('SetZOrder', 'UiBar', '=', '55'),
        label('UiText', `${W} / 2 - ${ZW} / 2 + 20`, '114', `${ZW} - 40`, '', { key: 'voiceLine', align: 'center', h: 44, expr: `"Głos szepcze: „" + ${V}.says + "”"` }),
        A('TextObject::ChangeColor', 'UiText', q('255;170;190')),
      ]),
    ]),
    ev([cmp('VoiceLineT', '>', '0')], [set('VoiceLineT', '-', dt)], [
      ev([cmp('VoiceLineT', '<', '1'), oisS('UiText', 'Key', '=', q('voiceLine'))], [opacity('UiText', '255 * max(0, VoiceLineT)')]),
      ev([cmp('VoiceLineT', '<', '1'), oisS('UiBar', 'Key', '=', q('voiceBack'))], [opacity('UiBar', '170 * max(0, VoiceLineT)')]),
      ev([cmp('VoiceLineT', '<=', '0')], [], ['voiceBack', 'voiceLine'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')]))),
    ]),
    comment('The voice\'s words and its ring follow it; when it is gone (silenced or swept away by the Sabbath) they go too.'),
    forEach('UiText', [oisS('UiText', 'Key', '=', q('voiceSays'))], [setB('found', false)], [
      ev([ois(T, 'Uid', '=', 'UiText.Arg'), oisB(T, 'Voice', true)], [
        A('SetXY', 'UiText', '=', `HolyHoly::ScreenX(${T}.X(), ${T}.Y(), 300) - UiText.Width() / 2`, '=', `HolyHoly::ScreenY(${T}.X(), ${T}.Y(), 300) - UiText.Height()`),
        setB('found', true),
      ]),
      ev([isB('found', false)], [A('Delete', 'UiText')]),
    ], { vars: { found: false } }),
    forEach('VoiceRing', [], [setB('found', false), scale('VoiceRing', '1 + 0.08 * sin(TimeFromStart() * 5)')], [
      ev([ois(T, 'Uid', '=', 'VoiceRing.Uid'), oisB(T, 'Voice', true)], [A('SetXY', 'VoiceRing', '=', `${T}.X()`, '=', `${T}.Y()`), setB('found', true)]),
      ev([isB('found', false)], [A('Delete', 'VoiceRing')]),
    ], { vars: { found: false } }),
    comment('Silenced: the lines of the thought record of this one thought, one after another (SilT), in flow (each line below the last), then they fade.'),
    ev([cmp('SilT', '=', '0')], [set('SilT', '=', '0.01')], [
      ...['silBack', 'silSays', 'silStrike', 'silPattern', 'silNo', 'silYes', 'stageBack', 'stageTitle', 'stageCaption', 'voiceBack', 'voiceLine'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')])),
      ev([], [set('CardT', '=', '-1')]),
      ev([], [
        A('Create', 'UiBar', `${W} / 2 - ${ZW} / 2`, '100', q('UI')), osetS('UiBar', 'Key', '=', q('silBack')), size('UiBar', ZW, '200'), tint('UiBar', q('14;10;24')), opacity('UiBar', '0'), A('SetZOrder', 'UiBar', '=', '55'),
        label('UiText', `${W} / 2 - ${ZW} / 2 + 20`, '106', `${ZW} - 40`, '', { key: 'silSays', align: 'center', h: 38, expr: `"„" + ${V}.says + "”"` }),
        A('TextObject::ChangeColor', 'UiText', q('255;170;190')), set('sy', '=', 'UiText.Y() + UiText.Height() + 2'),
        // the strike line is placed from the text's size here, where the text is the picked one
        set('sw', '=', 'min(UiText.Width(), StrLength(UiText.Text::Value()) * 12)'), set('sm', '=', 'UiText.Y() + UiText.Height() / 2'),
        A('Create', 'UiBar', `${W} / 2 - sw / 2`, 'sm', q('UI')), osetS('UiBar', 'Key', '=', q('silStrike')), size('UiBar', '2', '4'), tint('UiBar', q('255;80;80')), A('SetZOrder', 'UiBar', '=', '95'),
        tweenWidth('UiBar', 'strike', 'sw', '0.5'),
        label('UiSmall', `${W} / 2 - ${ZW} / 2 + 20`, 'sy', `${ZW} - 40`, '', { key: 'silPattern', align: 'center', h: 28, expr: `"Jak kłamie: " + ${V}.patternName + " (" + ${V}.signal + ")"` }),
        set('sy', '=', 'UiSmall.Y() + UiSmall.Height() + 4'),
        label('UiText', `${W} / 2 - ${ZW} / 2 + 20`, 'sy', `${ZW} - 40`, '', { key: 'silNo', align: 'center', h: 62, expr: `"Nie: " + ${V}.no` }),
        set('sy', '=', 'UiText.Y() + UiText.Height() + 4'),
        label('UiText', `${W} / 2 - ${ZW} / 2 + 20`, 'sy', `${ZW} - 40`, '', { key: 'silYes', align: 'center', h: 'max(30, 298 - sy)', expr: `${V}.yes` }),
        A('TextObject::ChangeColor', 'UiText', q('255;214;120')),
        set('sy', '=', 'UiText.Y() + UiText.Height() + 8'),
      ], [], { vars: { sy: 0, sw: 0, sm: 0 } }),
    ]),
    ev([cmp('SilT', '>', '0')], [set('SilT', '+', dt)], [
      ev([OR(oisS('UiAll', 'Key', '=', q('silPattern')), oisS('UiAll', 'Key', '=', q('silNo')), oisS('UiAll', 'Key', '=', q('silYes'))), ois('UiAll', 'Index', '=', '0'), cmp('SilT', '<', '0.1')], [opacity('UiAll', '0')]),
      ev([oisS('UiBar', 'Key', '=', q('silBack')), cmp('SilT', '<', '0.1')], [opacity('UiBar', '170')]),
      flow('silPattern', '0.6'), flow('silNo', '1.4'), flow('silYes', '2.4'),
      ev([cmp('SilT', '>', '2.4'), cmp('SilT', '<', '2.5'), C('BuiltinCommonInstructions::Once')], [sfx('revelation', '1')]),
      ev([cmp('SilT', '>', '7.5'), OR(...['silSays', 'silStrike', 'silPattern', 'silNo', 'silYes'].map(k => oisS('UiAll', 'Key', '=', q(k))))], [opacity('UiAll', '255 * max(0, 8.5 - SilT)')]),
      ev([cmp('SilT', '>', '7.5'), oisS('UiBar', 'Key', '=', q('silBack'))], [opacity('UiBar', '170 * max(0, 8.5 - SilT)')]),
      ev([cmp('SilT', '>', '8.5')], [set('SilT', '=', '-1')], ['silBack', 'silSays', 'silStrike', 'silPattern', 'silNo', 'silYes'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')]))),
    ]),
  ]);
}

// ─── memories: the story, found on the map ─────────────────────────────────────────────────────

function memoryEvents() {
  const W = 'SceneWindowWidth()', H = 'SceneWindowHeight()';
  const MEM = 'Content.chapters[Chapter].stages[Memories.Stage].memories[Memories.Index]';
  return group('Memories', [
    comment('A memory is a pale figure of the person standing somewhere on the map. Reaching it shows a fragment of the story (from the everyday to the core wound) at the bottom of the screen while the fight goes on, and gives light. A pointer at the edge of the screen leads to the nearest one; when hearts run low, it leads to a spring instead.'),
    forEach('Memories', [OR(playing(), isS('State', '=', q('sabbath'))), C('Distance', 'Memories', 'Player', 'Tuning.memoryReach')], [
      set('Run.memories', '+', '1'), sfx('bell'), ...particle('BurstLight', 'Memories.X()', 'Memories.Y()', '60'),
      set('MemoryT', '=', '8'),
    ], [
      ...['memoryBack', 'memoryHead', 'memory'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')])),
      ev([], [
        A('Create', 'UiBar', `${W} / 2 - ${MW} / 2 - 20`, `${H} - 216`, q('UI')), osetS('UiBar', 'Key', '=', q('memoryBack')), size('UiBar', `${MW} + 40`, '128'), tint('UiBar', q('16;14;30')), opacity('UiBar', '180'), A('SetZOrder', 'UiBar', '=', '55'),
        label('UiSmall', `${W} / 2 - ${MW} / 2`, `${H} - 210`, MW, '', { key: 'memoryHead', align: 'center', h: 28, expr: '"WSPOMNIENIE · " + ToString(Run.memories) + " z " + ToString(StageCount * 2)' }),
        A('TextObject::ChangeColor', 'UiSmall', q('190;200;255')),
        label('UiText', `${W} / 2 - ${MW} / 2`, `${H} - 180`, MW, '', { key: 'memory', align: 'center', h: 88, expr: `HolyHoly::G(${MEM})` }),
        A('TextObject::ChangeColor', 'UiText', q('232;236;255')),
      ]),
      repeat('6', [], [A('Create', 'LightShard', 'Memories.X() + RandomFloatInRange(-40, 40)', 'Memories.Y() + RandomFloatInRange(-40, 40)', '""'), A('AddForceAL', 'LightShard', 'RandomFloatInRange(0, 360)', '160', '0.6')]),
      ev([ois('MemoryLight', 'Uid', '=', 'Memories.Uid')], [A('Delete', 'MemoryLight')]),
      ev([], [A('Delete', 'Memories')]),
    ]),
    ev([cmp('MemoryT', '>', '0')], [set('MemoryT', '-', dt)], [
      ev([cmp('MemoryT', '<', '1'), OR(oisS('UiAll', 'Key', '=', q('memory')), oisS('UiAll', 'Key', '=', q('memoryHead')))], [opacity('UiAll', '255 * max(0, MemoryT)')]),
      ev([cmp('MemoryT', '<', '1'), oisS('UiBar', 'Key', '=', q('memoryBack'))], [opacity('UiBar', '180 * max(0, MemoryT)')]),
      ev([cmp('MemoryT', '<=', '0')], [], ['memoryBack', 'memoryHead', 'memory'].map(k => ev([oisS('UiAll', 'Key', '=', q(k))], [A('Delete', 'UiAll')]))),
    ]),
    ev([], [A('Scene3D::Model3DObject::SetScaleX', 'Memories', '=', '1 + 0.04 * sin(TimeFromStart() * 2)'), scale('MemoryLight', '1 + 0.1 * sin(TimeFromStart() * 3)')]),
    comment('The pointer: to the nearest spring with water when half the hearts are gone, otherwise to a voice that speaks, otherwise to the nearest memory; hidden when the target is close.'),
    ev([begins()], [
      A('Create', 'UiIcon', '0', '0', q('UI')), anim('UiIcon', 'pointer'), osetS('UiIcon', 'Key', '=', q('pointer')), A('SetZOrder', 'UiIcon', '=', '64'), A('Hide', 'UiIcon'),
      label('UiSmall', '0', '0', 160, '', { key: 'pointerText', align: 'center', h: 26 }),
    ]),
    ev([], [setB('PtOn', false)], [
      ev([OR(playing(), isS('State', '=', q('sabbath'))), cmp('Hearts', '<=', 'MaxHearts / 2'), ois('Spring', 'Water', '>', '0'), C('PickNearest', 'Spring', PX, PY)], [
        set('PtX', '=', 'Spring.X()'), set('PtY', '=', 'Spring.Y()'), setB('PtOn', true), setS('PtKind', '=', q('źródło')),
      ]),
      ev([playing(), isB('PtOn', false), oisB('Traumas', 'Voice', true), C('PickNearest', 'Traumas', PX, PY)], [
        set('PtX', '=', 'Traumas.X()'), set('PtY', '=', 'Traumas.Y()'), setB('PtOn', true), setS('PtKind', '=', q('głos')),
      ]),
      ev([OR(playing(), isS('State', '=', q('sabbath'))), isB('PtOn', false), C('PickNearest', 'Memories', PX, PY)], [
        set('PtX', '=', 'Memories.X()'), set('PtY', '=', 'Memories.Y()'), setB('PtOn', true), setS('PtKind', '=', q('wspomnienie')),
      ]),
      ev([isB('PtOn', true)], [set('PtA', '=', `AngleBetweenPositions(${PX}, ${PY}, PtX, PtY)`)]),
      ev([oisS('UiIcon', 'Key', '=', q('pointer'))], [A('Hide', 'UiIcon')], [
        ev([isB('PtOn', true), cmp(`DistanceBetweenPositions(${PX}, ${PY}, PtX, PtY)`, '>', '700')], [
          A('Show', 'UiIcon'), A('SetAngle', 'UiIcon', '=', 'PtA'),
          // an ellipse around the angel, flatter above it, where the voices and the stage card are
          A('SetXY', 'UiIcon', '=', `${W} / 2 + cos(ToRad(PtA)) * (${W} / 2 - 70)`, '=', `${H} / 2 + 40 + sin(ToRad(PtA)) * (130 + 100 * clamp(sin(ToRad(PtA)) + 1, 0, 1))`),
          scale('UiIcon', '0.9 + 0.12 * sin(TimeFromStart() * 5)'),
        ]),
        ev([isS('PtKind', '=', q('źródło'))], [A('ChangeColor', 'UiIcon', q('150;210;255'))]),
        ev([isS('PtKind', '=', q('wspomnienie'))], [A('ChangeColor', 'UiIcon', q('255;255;255'))]),
        ev([isS('PtKind', '=', q('głos'))], [A('ChangeColor', 'UiIcon', q('255;140;170'))]),
      ]),
      ev([oisS('UiSmall', 'Key', '=', q('pointerText'))], [text('UiSmall', '""')], [
        ev([isB('PtOn', true), cmp(`DistanceBetweenPositions(${PX}, ${PY}, PtX, PtY)`, '>', '700')], [
          text('UiSmall', 'PtKind'),
          A('SetXY', 'UiSmall', '=', `${W} / 2 + cos(ToRad(PtA)) * (${W} / 2 - 160) - 80`, '=', `${H} / 2 + 40 + sin(ToRad(PtA)) * (90 + 100 * clamp(sin(ToRad(PtA)) + 1, 0, 1)) - 12`),
        ]),
      ]),
    ], { vars: { PtX: 0, PtY: 0, PtA: 0, PtOn: false, PtKind: '' } }),
  ]);
}

// ─── healing: springs, words of truth, the breath ──────────────────────────────────────────────

function healingEvents() {
  const heal = why => [set('Hearts', '+', '1'), set('Run.healed', '+', '1'), sfx('grace'), ...particle('BurstHeal', PX, PY, '50'), ...banner(q(why), 1.4)];
  return group('Healing', [
    comment('Three ways to heal, besides the Sabbath and manna. Springs of living water (J 4,14): standing in one gives a heart every few seconds until it runs dry; it fills again after a while. A silenced voice leaves a word of truth: taking it gives a heart. And the breath: holding Q (or the breath button) while standing still, one cyclic sigh (in, a second sip, a long breath out) gives a heart, then needs a rest.'),
    forEach('Spring', [], [size('Spring', `Tuning.springRadius * 2 * (0.35 + 0.65 * Spring.Water / Tuning.springWater)`, `Tuning.springRadius * 2 * (0.35 + 0.65 * Spring.Water / Tuning.springWater)`)], [
      ev([ois('Spring', 'Water', '<=', '0')], [oset('Spring', 'Dry', '+', dt)], [
        ev([ois('Spring', 'Dry', '>=', 'Tuning.springRefill')], [oset('Spring', 'Water', '=', 'Tuning.springWater'), oset('Spring', 'Dry', '=', '0')]),
      ]),
      ev([OR(playing(), isS('State', '=', q('sabbath'))), ois('Spring', 'Water', '>', '0'), cmp('Hearts', '<', 'MaxHearts'), C('Distance', 'Player', 'Spring', 'Tuning.springRadius')], [oset('Spring', 'Tick', '+', dt)], [
        ev([ois('Spring', 'Tick', '>=', 'Tuning.springTick')], [oset('Spring', 'Tick', '=', '0'), oset('Spring', 'Water', '-', '1'), ...heal('Źródło: +1 serce')], [
          ev([isB('SpringSeen', false)], [setB('SpringSeen', true), ...banner(q('Źródło wody żywej (J 4,14): +1 serce'), 2.2)]),
        ]),
      ]),
    ]),
    ev([], [oset('Truth', 'T', '+', dt), setZ('Truth', '40 + 10 * sin(TimeFromStart() * 4)')]),
    forEach('Truth', [C('CollisionNP', 'Truth', 'Player')], [A('Delete', 'Truth')], [
      ev([cmp('Hearts', '<', 'MaxHearts')], heal('Słowo prawdy: +1 serce')),
      ev([cmp('Hearts', '>=', 'MaxHearts')], [set('Prayer', '=', 'min(100, Prayer + 20)'), sfx('grace'), ...banner(q('Słowo prawdy: modlitwa rośnie'), 1.4)]),
    ]),
    ev([C('Distance', 'Truth', 'Player', 'St.magnet')], [A('AddForceTowardPosition', 'Truth', PX, PY, '500', '0')]),
    ev([cmp('BreathCD', '>', '0')], [set('BreathCD', '-', dt)]),
    ev([playing(), OR(key('q'), C('SpriteMultitouchJoystick::IsButtonPressed', '1', q('C'))), cmp('Still', '>', '0.1'), cmp('BreathCD', '<=', '0'), cmp('Hearts', '<', 'MaxHearts')], [set('BreathT', '+', dt)]),
    ev([cmp('BreathT', '>', '0'), OR(NOT(playing()), AND(NOT(key('q')), NOT(C('SpriteMultitouchJoystick::IsButtonPressed', '1', q('C')))), cmp('Still', '<=', '0.1'))], [set('BreathT', '=', '0')]),
    ev([cmp('BreathT', '>=', 'Tuning.breathSeconds')], [set('BreathT', '=', '0'), set('BreathCD', '=', 'Tuning.breathCooldown')], [
      ev([cmp('Hearts', '<', 'MaxHearts')], heal('Westchnienie: +1 serce')),
    ]),
    ev([begins()], [
      A('Create', 'UiIcon', '0', '0', q('UI')), anim('UiIcon', 'breath'), osetS('UiIcon', 'Key', '=', q('breathRing')), A('SetZOrder', 'UiIcon', '=', '30'), A('Hide', 'UiIcon'),
      label('UiSmall', '0', '0', 300, '', { key: 'breathCue', align: 'center', h: 28 }),
    ]),
    ev([oisS('UiIcon', 'Key', '=', q('breathRing'))], [A('Hide', 'UiIcon')], [
      ev([cmp('BreathT', '>', '0')], [A('Show', 'UiIcon'), A('SetXY', 'UiIcon', '=', `HolyHoly::ScreenX(${PX}, ${PY}, 110)`, '=', `HolyHoly::ScreenY(${PX}, ${PY}, 110)`)], [
        ev([cmp('BreathT', '<', '2')], [scale('UiIcon', '0.35 + 0.4 * BreathT / 2')]),
        ev([cmp('BreathT', '>=', '2'), cmp('BreathT', '<', '2.5')], [scale('UiIcon', '0.75 + 0.2 * (BreathT - 2) / 0.5')]),
        ev([cmp('BreathT', '>=', '2.5')], [scale('UiIcon', '0.95 - 0.6 * (BreathT - 2.5) / (Tuning.breathSeconds - 2.5)')]),
      ]),
    ]),
    ev([oisS('UiSmall', 'Key', '=', q('breathCue'))], [text('UiSmall', '""')], [
      ev([cmp('BreathT', '>', '0')], [A('SetXY', 'UiSmall', '=', `HolyHoly::ScreenX(${PX}, ${PY}, 0) - 150`, '=', `HolyHoly::ScreenY(${PX}, ${PY}, 0) + 16`)], [
        ev([cmp('BreathT', '<', '2')], [text('UiSmall', q('wdech nosem…'))]),
        ev([cmp('BreathT', '>=', '2'), cmp('BreathT', '<', '2.5')], [text('UiSmall', q('…i jeszcze trochę'))]),
        ev([cmp('BreathT', '>=', '2.5')], [text('UiSmall', q('długi wydech ustami…'))]),
      ]),
    ]),
  ]);
}

/** Recognition: between stages, one thought of this chapter, shown with its answer (no guessing). */
function recognitionEvents() {
  const WD = 900, X = `(SceneWindowWidth() - ${WD}) / 2`;
  const V = 'Run.voice';
  return group('Recognition', [
    comment('Between stages the last voice of the stage is shown whole, as a worked example: what it said, how it lies (the thinking error and its signal words), the question that tests it, what negates it and the truth. Nothing to guess: the player reads and says the truth aloud (a heart and prayer). The lines flow one under another and shrink to fit.'),
    ev([isS('State', '=', q('recognize')), clicked('recogOpen')], [
      setS('Ui.top', '=', q('recog')), A('ChangeLayerTimeScale', '""', '0'), sfx('bell'),
    ], [
      ev([cmp('VoiceNext', '=', '0')], [A('HolyHoly::DrawVoice', 'Stage - 1'), set('VoiceNext', '=', 'Stage')]),
      ev([cmp('VoiceNext', '>', '0')], [A('HolyHoly::DrawVoice', 'VoiceNext - 1')]),
      ev([], [
        box(X, '70', WD, '580', { panel: 'recog' }),
        label('UiTitle', X, '88', WD, 'Rozpoznanie', { panel: 'recog', align: 'center', h: 50 }),
        label('UiSmall', `${X} + 60`, '146', WD - 120, '', { panel: 'recog', align: 'center', h: 28, expr: 'HolyHoly::G("Głos, który {imie} słyszy") + " (" + HolyHoly::StageClock(Stage - 1, 1) + "):"' }),
        set('ry', '=', 'UiSmall.Y() + UiSmall.Height() + 2'),
        label('UiText', `${X} + 60`, 'ry', WD - 120, '', { panel: 'recog', align: 'center', h: 70, expr: `"„" + ${V}.says + "”"` }),
        A('TextObject::ChangeColor', 'UiText', q('255;170;190')), set('ry', '=', 'UiText.Y() + UiText.Height() + 10'),
        label('UiSmall', `${X} + 60`, 'ry', WD - 120, '', { panel: 'recog', h: 56, expr: `"Jak kłamie: " + ${V}.patternName + ". Sygnał: " + ${V}.signal + "."` }),
        set('ry', '=', 'UiSmall.Y() + UiSmall.Height() + 6'),
        label('UiSmall', `${X} + 60`, 'ry', WD - 120, '', { panel: 'recog', h: 56, expr: `"Pytanie, które ją sprawdza: " + ${V}.question` }),
        set('ry', '=', 'UiSmall.Y() + UiSmall.Height() + 10'),
        label('UiText', `${X} + 60`, 'ry', WD - 120, '', { panel: 'recog', h: 90, expr: `"Nie: " + ${V}.no` }),
        set('ry', '=', 'UiText.Y() + UiText.Height() + 8'),
        label('UiText', `${X} + 60`, 'ry', WD - 120, '', { panel: 'recog', h: 90, expr: `"Prawda: " + ${V}.yes` }),
        A('TextObject::ChangeColor', 'UiText', q('255;214;120')),
        button(`${X} + ${WD / 2 - 200}`, '578', '400', '56', 'Powiedz to na głos (+1 serce)', 'recogSay', { panel: 'recog' }),
      ], [], { vars: { ry: 0 } }),
    ], { vars: { ry: 0 } }),
    ev([isS('State', '=', q('recognize')), OR(clicked('recogSay'), AND(clicked('close'), isS('Ui.top', '=', q('recog'))))], [
      setB('Recognized', true), setS('State', '=', q('sabbath')), setS('Ui.top', '=', '""'), A('ChangeLayerTimeScale', '""', '1'),
      set('Hearts', '=', 'min(MaxHearts, Hearts + 1)'), set('Prayer', '=', 'min(100, Prayer + 20)'), set('Run.recognized', '+', '1'), sfx('revelation', '1'),
      ...banner(q('Prawda powiedziana: +1 serce'), 1.6),
    ], closePanel('recog')),
  ]);
}

// ─── the lie of the chapter, personified, and the praise ────────────────────────────────────────

function liarEvents() {
  const S = 'Liar';
  const ring = n => repeat(n, [], [
    A('Create', 'Arrow', `${S}.X()`, `${S}.Y()`, '""'),
    setZ('Arrow', '70'),
    A('SetAngle', 'Arrow', '=', `k * 360 / (${n}) + BossSpin`),
    A('AddForceAL', 'Arrow', 'Arrow.Angle()', 'Tuning.bossArrowSpeed', '1'),
  ], [], { index: 'k', vars: { k: 0 } });
  return group('The lie personified', [
    comment('At the end of the chapter its lie comes in its own figure (an allegory, as in Prudentius\' Psychomachia: Dread, the Heart of Stone, Semblance, Emptiness…), saying the lie aloud above it. Phase 1 rains fiery arrows (Ef 6,16); phase 2 binds the person with chains (break them with strikes, ×3) and calls shadows; phase 3 charges. Each fall makes it 10% weaker. Its painting follows the invisible Liar object.'),
    ev([isS('State', '=', q('bossIntro'))], [set('StateT', '+', dt)], [
      ev([C('BuiltinCommonInstructions::Once')], [
        set('sx', '=', PX), set('sy', '=', `${PY} - 460`),
        set('sk', '=', `min(1, (${R} - 260) / max(1, sqrt(sx * sx + sy * sy)))`),
        A('Create', S, 'sx * sk', 'sy * sk', '""'), A('Hide', S),
        A('CreateByName', 'Bosses', `${CH}.boss.art`, 'sx * sk', 'sy * sk', '""'),
        setZ('Bosses', '-480'),
        A('Tween::AddObjectPositionZTween2', 'Bosses', 'Tween', 'Object3D', q('rise'), '0', q('easeOutCubic'), '1.6', 'no'),
        oset(S, 'MaxHp', '=', `${CH}.boss.hp * Tuning.bossHpScale * (1 - min(0.4, 0.1 * Run.falls)) * St.hpMul`),
        oset(S, 'Hp', '=', `${S}.MaxHp`),
        oset(S, 'Armor', '=', '1'), oset(S, 'PunchMul', '=', '1'), oset(S, 'Phase', '=', '1'), osetS(S, 'Kind', '=', q('liar')),
        set('BossArrowT', '=', '2.5'), set('BossSummonT', '=', '4'), set('BossDashT', '=', '4'),
        sfx('boss'), shake('0.6'), A('HolyHoly::Vibrate', '150'),
        ...banner(`${CH}.boss.name`, 3.2),
        label('UiText', '0', '0', 520, '', { align: 'center', key: 'lieSays', expr: `"„" + HolyHoly::G(${CH}.boss.lie) + "”"` }),
        A('TextObject::ChangeColor', 'UiText', q('255;150;150')), A('TextObject::Text::SetOutlineEnabled', 'UiText', 'yes'), A('TextObject::Text::SetOutlineColor', 'UiText', q('40;6;10')),
        A('SetZOrder', 'UiText', '=', '16'),
      ], [], { vars: {} }),
      ev([cmp('StateT', '>', '2.8')], [setS('State', '=', q('play'))]),
    ], { vars: { sx: 0, sy: 0, sk: 1 } }),
    // once the lie is gone its painting sinks where it stood (Liar.X() of no instance would be 0)
    ev([cmp('SceneInstancesCount(Liar)', '>', '0')], [A('SetXY', 'Bosses', '=', `${S}.X()`, '=', `${S}.Y() + 1`)]),
    ev([oisS('UiText', 'Key', '=', q('lieSays')), cmp('SceneInstancesCount(Liar)', '>', '0')], [
      A('SetXY', 'UiText', '=', `HolyHoly::ScreenX(${S}.X(), ${S}.Y(), 520) - UiText.Width() / 2`, '=', `max(96, HolyHoly::ScreenY(${S}.X(), ${S}.Y(), 520) - UiText.Height())`),
    ]),
    ev([oisS('UiText', 'Key', '=', q('lieSays')), cmp('SceneInstancesCount(Liar)', '=', '0')], [A('Delete', 'UiText')]),
    ev([playing(), cmp('SceneInstancesCount(Liar)', '>', '0')], [set('BossArrowT', '-', dt), set('BossSummonT', '-', dt), set('BossDashT', '-', dt), set('BossSpin', '+', `17 * ${dt}`)], [
      comment('Focus pierces the lie: with the multiplier at ×2 or more, everything hurts it 25% more.'),
      ev([ois(S, 'Armor', '>', '0'), cmp('MendiFocus::Multiplier()', '>=', '2')], [oset(S, 'Armor', '=', '1.25')]),
      ev([ois(S, 'Armor', '>', '0'), cmp('MendiFocus::Multiplier()', '<', '2'), NOT(hero('michal'))], [oset(S, 'Armor', '=', '1')]),
      ev([ois(S, 'Armor', '>', '0'), cmp('MendiFocus::Multiplier()', '<', '2'), hero('michal')], [oset(S, 'Armor', '=', '1.1')]),
      ev([ois(S, 'Phase', '=', '1'), cmp(`${S}.Hp`, '<', `${S}.MaxHp * 0.66`)], [
        oset(S, 'Phase', '=', '2'), oset(S, 'Armor', '=', '0'), sfx('boss'), shake('0.4'),
        ...banner(q('Łańcuchy kłamstwa! Rozbij je ciosem (spacja)'), 3),
      ], [
        repeat('4', [], [
          A('Create', 'ChainPylon', `${S}.X() + cos(ToRad(k * 90 + 45)) * 260`, `${S}.Y() + sin(ToRad(k * 90 + 45)) * 260`, '""'),
          oset('ChainPylon', 'MaxHp', '=', `${S}.MaxHp * 0.07`), oset('ChainPylon', 'Hp', '=', `${S}.MaxHp * 0.07`),
          oset('ChainPylon', 'Armor', '=', '1'), oset('ChainPylon', 'PunchMul', '=', '3'),
        ], [], { index: 'k', vars: { k: 0 } }),
      ]),
      ev([ois(S, 'Phase', '=', '2'), ois(S, 'Armor', '<=', '0'), cmp('SceneInstancesCount(ChainPylon)', '=', '0')], [oset(S, 'Armor', '=', '1'), sfx('revelation'), ...banner(q('Łańcuchy pękają!'), 2)]),
      ev([ois(S, 'Phase', '=', '2'), ois(S, 'Armor', '>', '0'), cmp(`${S}.Hp`, '<', `${S}.MaxHp * 0.33`)], [oset(S, 'Phase', '=', '3'), shake('0.4'), ...banner(`${CH}.boss.name + " słabnie!"`, 1.8)]),
      ev([ois(S, 'Phase', '!=', '3')], [A('AddForceTowardPosition', S, PX, PY, '38', '0')]),
      ev([ois(S, 'Phase', '=', '3'), cmp('BossDashT', '<=', '0')], [set('BossDashT', '=', '4.5'), set('DashBoss', '=', `${S}.AngleToPosition(${PX}, ${PY})`), oset(S, 'T', '=', '0'), shake('0.2')]),
      ev([ois(S, 'Phase', '=', '3'), cmp('BossDashT', '>', '3.9')], [A('AddForceAL', S, 'DashBoss', '520', '0')]),
      ev([cmp('BossArrowT', '<=', '0'), ois(S, 'Phase', '!=', '3')], [set('BossArrowT', '=', '3.4'), sfx('weaken')], [ring('12')]),
      ev([cmp('BossArrowT', '<=', '0'), ois(S, 'Phase', '=', '3')], [set('BossArrowT', '=', '2.2'), sfx('weaken')], [ring('16')]),
      ev([cmp('BossSummonT', '<=', '0'), ois(S, 'Phase', '=', '2')], [set('BossSummonT', '=', '6')], [
        repeat('3', [], [
          set('sx', '=', `${S}.X() + cos(ToRad(RandomFloatInRange(0, 360))) * 200`),
          set('sy', '=', `${S}.Y() + sin(ToRad(RandomFloatInRange(0, 360))) * 200`),
        ], [spawn('sx', 'sy', `${CH}.enemies[RandomInRange(0, KindCount - 1)]`)], { vars: { sx: 0, sy: 0 } }),
      ]),
      ev([C('CollisionNP', 'Player', S), cmp('Invuln', '<=', '0')], [setB('HurtNow', true), A('AddForceAL', 'Player', `${S}.AngleToPosition(${PX}, ${PY}) + 180`, '900', '0')]),
      ev([], [A('SeparateFromObjects', 'Player', S)]),
    ]),
    ev([playing()], [], [
      ev([ois('ChainPylon', 'Hp', '<=', '0')], [sfx('revelation'), ...particle('BurstLight', 'ChainPylon.X()', 'ChainPylon.Y()', '70'), A('Delete', 'ChainPylon')]),
    ]),
    ev([playing(), cmp('SceneInstancesCount(Liar)', '>', '0'), ois(S, 'Hp', '<=', '0')], [
      setS('State', '=', q('bossDown')), set('StateT', '=', '0'),
      sfx('revelation'), shake('0.8'), A('HolyHoly::Vibrate', '200'),
      ...banner(`${CH}.boss.name + " milknie"`, 3.5),
      ...particle('BurstLight', `${S}.X()`, `${S}.Y()`, '150'), ...particle('BurstShadow', `${S}.X()`, `${S}.Y()`, '80'),
      A('Tween::AddObjectPositionZTween2', 'Bosses', 'Tween', 'Object3D', q('sink'), '-520', q('easeInCubic'), '2.2', 'yes'),
      A('Delete', S), A('Delete', 'ChainPylon'), A('Delete', 'Arrow'),
      A('ChangeTimeScale', '0.5'),
    ], [
      forEach('Traumas', [], [...particle('BurstShadow', 'Traumas.X()', 'Traumas.Y()', '30'), A('Create', 'LightShard', 'Traumas.X()', 'Traumas.Y()', '""'), A('Delete', 'Traumas')]),
    ]),
    ev([isS('State', '=', q('bossDown'))], [set('StateT', '+', `${dt} / max(0.1, TimeScale())`)], [
      ev([cmp('StateT', '>', '1.2')], [A('ChangeTimeScale', '1')]),
      ev([cmp('StateT', '>', '3')], [
        A('ChangeTimeScale', '1'),
        setS('State', '=', q('praise')), set('PraiseT', '=', 'Tuning.praiseSeconds'),
        ...banner(q('Uwielbienie! Zbieraj światło'), 2.6), sfx('rank'),
      ]),
    ]),
    comment('Praise: after the lie falls silent, light rains on the angel for a few seconds (Heroes vs Hordes\' coin rush, as joy rather than greed). Then the healing scene with Christ.'),
    ev([isS('State', '=', q('praise'))], [set('PraiseT', '-', dt), set('SeedT', '-', dt), A('ActivateBehavior', 'Player', 'TopDownMovement', 'yes')], [
      ev([cmp('SeedT', '<=', '0')], [set('SeedT', '=', '0.08')], [
        repeat('2', [], [
          A('Create', 'LightShard', `${PX} + RandomFloatInRange(-520, 520)`, `${PY} + RandomFloatInRange(-420, 420)`, '""'),
          oset('LightShard', 'Value', '=', '2'), setZ('LightShard', '360'),
          A('Tween::AddObjectPositionZTween2', 'LightShard', 'Tween', 'Object3D', q('fall'), '20', q('easeInQuad'), '0.6', 'no'),
        ]),
      ]),
      ev([cmp('PraiseT', '<=', '0')], [
        set('Run.time', '=', 'round(Run.time)'),
        setS('Run.story', '=', q('heal')), setS('Run.next', '=', q('Revelation')),
        scene('Story'),
      ]),
    ]),
  ]);
}


// ─── wounds, falling and rising ────────────────────────────────────────────────────────────────

function hurtEvents() {
  const X = '(SceneWindowWidth() - 940) / 2';
  return group('Wounds and rising', [
    comment('No game over: when the shadows overwhelm, the person falls and Christ reaches out a hand (Mt 14,31). The player only responds: "Take His hand". Grace grows with each fall: the lie gets weaker, the stage gives more time.'),
    ev([isB('HurtNow', true), cmp('Invuln', '<=', '0'), playing()], [setB('HurtNow', false)], [
      ev([cmp('RandomFloatInRange(0, 100)', '<', 'St.dodge')], [set('Invuln', '=', '0.4'), sfx('grace'), ...banner(q('Pancerz sprawiedliwości: unik'), 1)]),
      ev([cmp('Invuln', '<=', '0')], [
        set('Hearts', '-', '1'), set('Invuln', '=', 'St.grace'), set('FlashT', '=', '0.35'), set('BreathT', '=', '0'),
        sfx('hurt'), shake('0.35'), A('HolyHoly::Vibrate', '80'), set('Combo', '=', '0'),
      ], [
        ev([isB('Save.settings.gentle', true)], [set('Invuln', '+', '0.6')]),
        ev([cmp(G('ucisz'), '>', '0'), C('Distance', 'Traumas', 'Player', `260 + 80 * ${step(G('ucisz'), 3)}`)], [oset('Traumas', 'Stun', '=', `0.5 + ${G('ucisz')}`)]),
        ev([cmp('Hearts', '<=', '0'), cmp(G('helm'), '>', '0'), isB('HelmUsed', false)], [
          setB('HelmUsed', true), set('Hearts', '=', '2'), set('Invuln', '=', '2.5'), sfx('rank'), ...banner(q('Hełm zbawienia: należysz do Boga'), 2.4),
        ]),
        ev([cmp('Hearts', '<=', '0')], [
          setS('State', '=', q('fallen')), setS('Ui.top', '=', q('fall')),
          set('Run.falls', '+', '1'), set('Save.falls', '+', '1'),
          A('ChangeLayerTimeScale', '""', '0.15'),
          sfx('fall'),
          A('Psalm150::SetMood', `${CH}.track`, q('sabbath'), '0.05'),
          box(X, '60', '940', '600', { panel: 'fall' }),
          label('UiTitle', X, '80', 940, 'Choć upadłem, powstanę', { panel: 'fall', align: 'center', key: 'fallTitle', h: 52 }),
          label('UiText', `${X} + 470`, '150', 420, '', { panel: 'fall', h: 170, expr: 'HolyHoly::G(Content.story.fall.lines[RandomInRange(0, VariableChildCount(Content.story.fall.lines) - 1)])' }),
          set('fv', '=', 'RandomInRange(0, VariableChildCount(Content.story.fall.verses) - 1)'),
          label('UiSmall', `${X} + 470`, '330', 420, '', { panel: 'fall', h: 220, expr: '"„" + Content.story.fall.verses[fv].text + "” (" + Content.story.fall.verses[fv].ref + ")"' }),
          button(`${X} + 520`, '570', '320', '60', '', 'rise', { panel: 'fall', captionExpr: 'Content.story.fall.button' }),
        ], [
          ev([isB('Save.settings.veiled', false)], [
            A('Create', 'UiArt', `${X} + 240`, '370', q('UI')), anim('UiArt', 'christ-hand'), size('UiArt', '420', '420 * 657 / 960'), osetS('UiArt', 'Panel', '=', q('fall')), A('SetZOrder', 'UiArt', '=', '260'),
          ]),
          ev([oisS('UiTitle', 'Key', '=', q('fallTitle'))], [text('UiTitle', 'HolyHoly::G("Choć {upadłem|upadłam}, powstanę")')]),
        ]),
      ], { vars: { fv: 0 } }),
    ]),
    ev([isB('HurtNow', true)], [setB('HurtNow', false)]),
    ev([isS('State', '=', q('fallen')), OR(keyJust('Return'), keyJust('Space'))], [setS('Ui.clicked', '=', q('rise'))]),
    ev([isS('State', '=', q('fallen')), clicked('rise')], [
      setS('State', '=', q('play')), setS('Ui.top', '=', '""'),
      A('ChangeLayerTimeScale', '""', '1'),
      set('Hearts', '=', 'MaxHearts'), set('Invuln', '=', '3'), set('Prayer', '=', 'max(Prayer, 30)'),
      set('StageTime', '=', 'max(StageTime, 20)'),
      set('Save.rises', '+', '1'),
      sfx('grace'), ...banner(q('Wstań: łaska nie kończy się po upadku'), 2.2),
      ...particle('BurstLight', PX, PY, '60'),
      A('Create', 'Shockwave', PX, PY, '""'), oset('Shockwave', 'Radius', '=', '650'), oset('Shockwave', 'Life', '=', '0.6'),
    ], [
      ...closePanel('fall'),
      ev([C('Distance', 'Traumas', 'Player', '650'), NOT(oisB('Traumas', 'Elite', true))], [A('Delete', 'Traumas')]),
      ev([], [A('Delete', 'Arrow')]),
      ev([ois('Liar', 'Hp', '>', '0'), cmp('Run.falls', '<=', '4')], [oset('Liar', 'Hp', '-', 'Liar.MaxHp * 0.1')]),
    ]),
    ev([cmp('Invuln', '>', '0')], [set('Invuln', '-', dt)]),
    ev([cmp('Invuln', '>', '0'), cmp('mod(floor(Invuln * 12), 2)', '=', '0')], [A('Hide', 'Heroes')]),
    ev([OR(cmp('Invuln', '<=', '0'), cmp('mod(floor(Invuln * 12), 2)', '=', '1'))], [A('Show', 'Heroes')]),
  ]);
}

// ─── pause ─────────────────────────────────────────────────────────────────────────────────────

function pauseEvents() {
  const X = '(SceneWindowWidth() - 560) / 2';
  return group('Pause', [
    ev([playing(), OR(keyJust('Escape'), keyJust('p'))], [setS('Ui.clicked', '=', q('pause'))]),
    ev([playing(), clicked('pause')], [
      setS('PrevState', '=', 'State'), setS('State', '=', q('pause')), setS('Ui.top', '=', q('pause')),
      A('ChangeLayerTimeScale', '""', '0'),
      box(X, '70', '560', '590', { panel: 'pause' }),
      label('UiTitle', X, '92', 560, 'Pauza', { panel: 'pause', align: 'center' }),
      label('UiSmall', '(SceneWindowWidth() - 500) / 2', '150', 500, '', { panel: 'pause', align: 'center', key: 'nowPlaying', h: 40 }),
      button('(SceneWindowWidth() - 340) / 2', '200', '340', '56', 'Wróć do gry', 'resume', { panel: 'pause' }),
      button('(SceneWindowWidth() - 340) / 2', '268', '340', '56', 'Ustawienia', 'settings', { panel: 'pause' }),
      button('(SceneWindowWidth() - 340) / 2', '336', '340', '56', 'Następny utwór', 'nexttrack', { panel: 'pause' }),
      button('(SceneWindowWidth() - 340) / 2', '404', '340', '56', 'Pomoc w kryzysie', 'helplines', { panel: 'pause' }),
      button('(SceneWindowWidth() - 340) / 2', '472', '340', '56', 'Opuść rozdział', 'leave', { panel: 'pause' }),
      label('UiSmall', '(SceneWindowWidth() - 500) / 2', '546', 500, 'To gra, nie terapia. Jeśli jest ci ciężko, porozmawiaj z kimś.', { panel: 'pause', align: 'center', h: 54 }),
    ]),
    ev([oisS('UiSmall', 'Key', '=', q('nowPlaying'))], [text('UiSmall', '"♪ " + Psalm150::NowPlaying()')]),
    ev([isS('State', '=', q('pause')), OR(clicked('resume'), AND(clicked('close'), isS('Ui.top', '=', q('pause'))))], [
      setS('State', '=', 'PrevState'), setS('Ui.top', '=', '""'), A('ChangeLayerTimeScale', '""', '1'),
    ], closePanel('pause')),
    ev([isS('State', '=', q('pause')), clicked('nexttrack')], [A('Psalm150::NextTrack')]),
    ev([isS('State', '=', q('pause')), clicked('settings')], [setS('Ui.top', '=', q('settings')), ...settingsPanel('settings')]),
    ev([isS('State', '=', q('pause')), clicked('close'), isS('Ui.top', '=', q('settings'))], [setS('Ui.top', '=', q('pause'))], closePanel('settings')),
    ev([isS('State', '=', q('pause')), clicked('helplines')], [
      setS('Ui.top', '=', q('help')),
      box('(SceneWindowWidth() - 820) / 2', '60', '820', '600', { panel: 'help' }),
      label('UiTitle', '(SceneWindowWidth() - 820) / 2', '80', 820, 'Pomoc w kryzysie', { panel: 'help', align: 'center' }),
      label('UiSmall', '(SceneWindowWidth() - 740) / 2', '146', 740, '', { panel: 'help', h: 430, expr: 'Content.story.helplinesText + NewLine() + NewLine() + "Jeśli myślisz o odebraniu sobie życia, nie zostawaj z tym sam na sam. Zadzwoń teraz albo powiedz komuś obok."' }),
      button('(SceneWindowWidth() - 240) / 2', '590', '240', '54', 'Wróć', 'close', { panel: 'help' }),
    ]),
    ev([isS('State', '=', q('pause')), clicked('close'), isS('Ui.top', '=', q('help'))], [setS('Ui.top', '=', q('pause'))], closePanel('help')),
    settingsEvents(),
    ev([clicked('effects')], [], applyQuality()),
    ev([clicked('gentle')], [setB('StatsDirty', true)]),
    ev([isS('State', '=', q('pause')), clicked('leave')], [
      set('Save.light', '+', 'round(Run.light)'), store(),
      A('ChangeLayerTimeScale', '""', '1'),
      scene('Ladder'),
    ]),
  ]);
}

// ─── camera, music, effects ────────────────────────────────────────────────────────────────────

function feedbackEvents() {
  return group('Camera, music and effects', [
    comment('The camera follows the angel from above and behind, from far enough to see the shadows coming; it leads a little ahead (CamLead), so the angel stands below the centre and the top of the screen is free for the voices and the stage card. A short shake on strong hits (off in the settings or with reduced motion).'),
    ev([], [
      A('SetCameraCenterX', '=', `lerp(CameraCenterX(""), ${PX}, min(1, 7 * ${dt}))`, '""'),
      A('SetCameraCenterY', '=', `lerp(CameraCenterY(""), ${PY} + CamZ * tan(ToRad(CamTilt)) - CamLead, min(1, 7 * ${dt}))`, '""'),
    ]),
    ev([cmp('Shake', '>', '0'), isB('Save.settings.shake', true), NOT(C('HolyHoly::PrefersReducedMotion'))], [
      A('SetCameraCenterX', '+', 'RandomFloatInRange(-1, 1) * Shake * 26', '""'),
      A('SetCameraCenterY', '+', 'RandomFloatInRange(-1, 1) * Shake * 26', '""'),
    ]),
    ev([], [set('Shake', '=', `max(0, Shake - 1.6 * ${dt})`)]),
    comment('Shock waves: a ring of light that grows to its radius and vanishes. Glows: the light a broken shadow leaves.'),
    ev([], [oset('Shockwave', 'T', '+', dt), oset('Glow', 'T', '+', dt)], [
      ev([], [
        A('ResizableCapability::ResizableBehavior::SetSize', 'Shockwave', 'Resizable', 'Shockwave.Radius * 2 * min(1, Shockwave.T / Shockwave.Life)', 'Shockwave.Radius * 2 * min(1, Shockwave.T / Shockwave.Life)'),
        A('Scene3D::Base3DBehavior::SetDepth', 'Shockwave', 'Object3D', '=', '40'),
        size('Glow', '90 + 260 * Glow.T', '90 + 260 * Glow.T'),
      ]),
      ev([ois('Shockwave', 'T', '>', 'Shockwave.Life + 0.1')], [A('Delete', 'Shockwave')]),
      ev([ois('Glow', 'T', '>', '0.45')], [A('Delete', 'Glow')]),
    ]),
    comment('The music follows the fight: the chapter\'s piece, more layers with more shadows, the boss scene for the lie personified (Psalm150 extension).'),
    ev([], [set('Tm.music', '-', dt)], [
      ev([cmp('Tm.music', '<=', '0')], [set('Tm.music', '=', '0.5')], [
        ev([playing(), cmp('Stage', '<=', 'StageCount')], [A('Psalm150::SetMood', `${CH}.track`, q('battle'), 'clamp(0.3 + SceneInstancesCount(Traumas) / 45, 0.3, 0.8)')]),
        ev([OR(isS('State', '=', q('bossIntro')), AND(playing(), cmp('Stage', '>', 'StageCount')))], [A('Psalm150::SetMood', `${CH}.track`, q('boss'), '0.85 + 0.05 * (Liar.Phase - 1)')]),
        ev([OR(isS('State', '=', q('sabbath')), isS('State', '=', q('recognize')))], [A('Psalm150::SetMood', `${CH}.track`, q('sabbath'), '0.05')]),
        ev([OR(isS('State', '=', q('bossDown')), isS('State', '=', q('praise')))], [A('Psalm150::SetMood', `${CH}.track`, q('victory'), '0.7')]),
      ]),
    ]),
  ]);
}

// ─── HUD ───────────────────────────────────────────────────────────────────────────────────────

function hudEvents() {
  const W = 'SceneWindowWidth()', H = 'SceneWindowHeight()';
  const keyed = (obj, k, actions, extra = []) => ev([oisS(obj, 'Key', '=', q(k)), ...extra], actions);
  const icon = (k, x, y, s) => [A('Create', 'UiIcon', x, y, q('UI')), osetS('UiIcon', 'Key', '=', q(k)), oset('UiIcon', 'Index', '=', 'k'), scale('UiIcon', String(s))];
  const bar = (k, x, y, w, h, color, z = 60) => [
    A('Create', 'UiBar', x, y, q('UI')), osetS('UiBar', 'Key', '=', q(k)), size('UiBar', w, h), tint('UiBar', q(color)), A('SetZOrder', 'UiBar', '=', String(z)),
  ];
  const art = (k, x, y, s, index = '0') => [A('Create', 'UiArt', x, y, q('UI')), osetS('UiArt', 'Key', '=', q(k)), oset('UiArt', 'Index', '=', index), size('UiArt', s, s), A('SetZOrder', 'UiArt', '=', '62')];
  const slotRow = (k, y) => repeat('4', [], [
    ...art(k, '44 + k * 62', y, '56', 'k'),
    label('UiSmall', '16 + k * 62', `${y} + 26`, 56, '', { key: `${k}Lv`, align: 'center' }),
    oset('UiSmall', 'Index', '=', 'k'),
  ], [], { index: 'k', vars: { k: 0 } });
  const slotUpdate = (k, list) => [
    ev([oisS('UiArt', 'Key', '=', q(k)), ois('UiArt', 'Index', '<', `VariableChildCount(${list})`)], [A('Show', 'UiArt')], [
      forEach('UiArt', [oisS('UiArt', 'Key', '=', q(k)), ois('UiArt', 'Index', '<', `VariableChildCount(${list})`)], [animE('UiArt', `HolyHoly::SkillIcon(${list}[UiArt.Index])`), size('UiArt', '56', '56')]),
    ]),
    ev([oisS('UiArt', 'Key', '=', q(k)), ois('UiArt', 'Index', '>=', `VariableChildCount(${list})`)], [A('Hide', 'UiArt')]),
    forEach('UiSmall', [oisS('UiSmall', 'Key', '=', q(`${k}Lv`))], [text('UiSmall', '""')], [
      ev([ois('UiSmall', 'Index', '<', `VariableChildCount(${list})`)], [text('UiSmall', `HolyHoly::PipsText(Run.gifts[${list}[UiSmall.Index]], Content.skills[${list}[UiSmall.Index]].maxLevel)`)]),
      ev([ois('UiSmall', 'Index', '<', `VariableChildCount(${list})`), isB(`Run.evo[${list}[UiSmall.Index]]`, true)], [text('UiSmall', q('★'))]),
    ]),
  ];
  const progress = '1 - clamp(StageTime / Tuning.stageSeconds, 0, 1)';
  return group('HUD', [
    comment('Top left: the archangel\'s portrait, hearts, prayer (its percentage under the bar), then the four gifts and four virtues. Top centre: the light bar with the level, the chapter and the stage under it; the lie\'s strength when it comes. Top right: the person\'s clock (it runs with the stage), the time left, pause. Bottom right: the prayer button. Bottom centre: focus. Banners appear under the angel, so they never cover it.'),
    ev([begins()], [
      ...art('portrait', '70', '70', '112'),
      label('UiSmall', '134', '4', 360, '', { key: 'heroName', h: 26, expr: `${HERO}.name + " · " + ${HERO}.meaning` }),
      ...bar('prayerBg', '132', '64', '232', '16', '40;32;56', 58),
      ...bar('prayer', '134', '66', '10', '12', '255;214;120', 59),
      label('UiSmall', '134', '82', 230, '', { key: 'prayerPct', h: 24 }),
      ...bar('xpBg', `${W} / 2 - 250`, '12', '500', '24', '30;24;44', 58),
      ...bar('xp', `${W} / 2 - 247`, '15', '10', '18', '240;204;110', 59),
      label('UiSmall', `${W} / 2 - 260`, '40', 520, '', { key: 'chapter', align: 'center', h: 26 }),
      label('UiTitle', `${W} - 330`, '6', 210, '', { key: 'clock', align: 'right' }),
      label('UiSmall', `${W} - 330`, '54', 210, '', { key: 'wave', align: 'right', h: 26 }),
      button(`${W} - 100`, '16', '76', '48', 'II', 'pause'),
      ...bar('focusBg', `${W} / 2 - 180`, `${H} - 34`, '360', '14', '40;32;56', 58),
      ...bar('focus', `${W} / 2 - 178`, `${H} - 32`, '10', '10', '160;220;255', 59),
      ...bar('focusMark', `${W} / 2 - 180 + 360 * MendiFocus::Threshold()`, `${H} - 38`, '3', '22', '255;255;255', 60),
      label('UiSmall', `${W} / 2 - 300`, `${H} - 64`, 600, '', { key: 'focus', align: 'center', h: 26 }),
      ...art('ult', `${W} - 92`, `${H} - 250`, '104'),
      label('UiSmall', `${W} - 172`, `${H} - 192`, 160, '', { key: 'ultText', align: 'center', h: 50 }),
      label('UiTitle', `${W} - 330`, '330', 300, '', { key: 'combo', align: 'right' }),
      label('UiBig', '40', `${H} / 2 + 86`, `${W} - 80`, '', { key: 'banner', align: 'center' }),
      ...bar('bossBg', `${W} / 2 - 300`, '70', '600', '18', '40;20;24', 58),
      ...bar('boss', `${W} / 2 - 298`, '72', '10', '14', '255;90;60', 59),
      label('UiSmall', '16', `${H} - 30`, 520, '', { key: 'helplines', h: 26 }),
      ...bar('flash', '0', '0', W, H, '255;40;60', 40),
    ], [
      slotRow('slotW', '156'),
      slotRow('slotV', '230'),
      ev([oisS('UiArt', 'Key', '=', q('portrait'))], [animE('UiArt', 'Run.hero + "-icon"'), size('UiArt', '112', '112')]),
      ev([oisS('UiArt', 'Key', '=', q('ult'))], [animE('UiArt', '"ult-" + Run.hero'), size('UiArt', '104', '104'), osetS('UiArt', 'Action', '=', q('pray'))]),
      ev([oisS('UiSmall', 'Key', '=', q('heroName'))], [A('TextObject::ChangeColor', 'UiSmall', q('255;226;150'))]),
      ev([oisS('UiSmall', 'Key', '=', q('helplines')), isB(`${CH}.helplines`, true)], [text('UiSmall', '"Pomoc całą dobę: " + Content.story.helplinesShort')]),
      ev([oisS('UiTitle', 'Key', '=', q('clock'))], [A('TextObject::Text::SetFontSize', 'UiTitle', '=', '34')]),
      ev([oisS('UiBig', 'Key', '=', q('banner'))], [A('TextObject::Text::SetFontSize', 'UiBig', '=', '46')]),
    ]),
    ev([isB('HudDirty', true)], [setB('HudDirty', false)], [
      ev([oisS('UiIcon', 'Key', '=', q('heart'))], [A('Delete', 'UiIcon')]),
      repeat('MaxHearts', [], [...icon('heart', '146 + k * 32', '40', 0.3)], [], { index: 'k', vars: { k: 0 } }),
      ...slotUpdate('slotW', 'Run.weapons'),
      ...slotUpdate('slotV', 'Run.virtues'),
    ]),
    ev([oisS('UiIcon', 'Key', '=', q('heart')), ois('UiIcon', 'Index', '<', 'Hearts')], [anim('UiIcon', 'heart')]),
    ev([oisS('UiIcon', 'Key', '=', q('heart')), ois('UiIcon', 'Index', '>=', 'Hearts')], [anim('UiIcon', 'heartEmpty')]),
    keyed('UiBar', 'prayer', [width('UiBar', '228 * clamp(Prayer / 100, 0, 1) + 0.01')]),
    keyed('UiBar', 'prayer', [tint('UiBar', q('255;246;200'))], [cmp('Prayer', '>=', '100')]),
    keyed('UiBar', 'prayer', [tint('UiBar', q('255;196;90'))], [cmp('Prayer', '<', '100')]),
    keyed('UiSmall', 'prayerPct', [text('UiSmall', '"Modlitwa " + ToString(floor(Prayer)) + "%"')]),
    keyed('UiArt', 'ult', [opacity('UiArt', '255'), size('UiArt', '104 + 8 * sin(TimeFromStart() * 6)', '104 + 8 * sin(TimeFromStart() * 6)')], [cmp('Prayer', '>=', '100')]),
    keyed('UiArt', 'ult', [opacity('UiArt', '90 + 120 * Prayer / 100'), size('UiArt', '96', '96')], [cmp('Prayer', '<', '100')]),
    keyed('UiSmall', 'ultText', [text('UiSmall', `${HERO}.ultimate.name + NewLine() + "(E)"`)], [isB('Ui.touch', false)]),
    keyed('UiSmall', 'ultText', [text('UiSmall', `${HERO}.ultimate.name`)], [isB('Ui.touch', true)]),
    keyed('UiBar', 'xp', [width('UiBar', '494 * clamp(Xp / XpNext, 0, 1) + 0.01')]),
    keyed('UiSmall', 'chapter', [text('UiSmall', `"Poziom " + ToString(Level) + " · " + ${CH}.title + " · etap " + ToString(Stage) + " z " + ToString(StageCount) + " · " + HolyHoly::G(${ST}.title)`)], [cmp('Stage', '<=', 'StageCount')]),
    keyed('UiSmall', 'chapter', [text('UiSmall', `"Poziom " + ToString(Level) + " · " + ${CH}.title + " · " + ${CH}.boss.name`)], [cmp('Stage', '>', 'StageCount')]),
    keyed('UiTitle', 'clock', [text('UiTitle', `HolyHoly::StageClock(Stage - 1, ${progress})`)], [cmp('Stage', '<=', 'StageCount')]),
    keyed('UiTitle', 'clock', [text('UiTitle', 'HolyHoly::StageClock(StageCount - 1, 1)')], [cmp('Stage', '>', 'StageCount')]),
    keyed('UiSmall', 'wave', [text('UiSmall', '"zostało " + HolyHoly::Clock(StageTime)')], [cmp('Stage', '<=', 'StageCount')]),
    keyed('UiSmall', 'wave', [text('UiSmall', `${CH}.boss.name`)], [cmp('Stage', '>', 'StageCount')]),
    keyed('UiBar', 'focus', [width('UiBar', '356 * clamp(MendiFocus::Level(), 0, 1) + 0.01')]),
    keyed('UiBar', 'focus', [tint('UiBar', q('255;214;120'))], [C('MendiFocus::IsFocused')]),
    keyed('UiBar', 'focus', [tint('UiBar', q('160;200;255'))], [NOT(C('MendiFocus::IsFocused'))]),
    keyed('UiSmall', 'focus', [text('UiSmall', '"Skupienie ×" + HolyHoly::Decimal(MendiFocus::Multiplier()) + " · opaska Mendi"')], [cmpS('MendiFocus::Source()', '=', q('band'))]),
    keyed('UiSmall', 'focus', [text('UiSmall', '"Skupienie ×" + HolyHoly::Decimal(MendiFocus::Multiplier()) + " · bezruch"')], [cmpS('MendiFocus::Source()', '=', q('still'))]),
    keyed('UiSmall', 'focus', [text('UiSmall', '"Skupienie ×" + HolyHoly::Decimal(MendiFocus::Multiplier()) + " · stań, aby się skupić"')], [cmpS('MendiFocus::Source()', '=', q('none'))]),
    keyed('UiTitle', 'combo', [text('UiTitle', '"Cios ×" + ToString(Combo)'), opacity('UiTitle', '255'), A('TextObject::Text::SetFontSize', 'UiTitle', '=', '40 + min(Combo, 20)')], [cmp('Combo', '>=', '2')]),
    keyed('UiTitle', 'combo', [text('UiTitle', q('Pudło')), opacity('UiTitle', '200')], [cmp('Combo', '<', '2'), cmp('MissT', '>', '0')]),
    keyed('UiTitle', 'combo', [text('UiTitle', '""')], [cmp('Combo', '<', '2'), cmp('MissT', '<=', '0')]),
    keyed('UiBig', 'banner', [text('UiBig', 'BannerText'), opacity('UiBig', '255 * clamp(BannerT * 2, 0, 1)')]),
    ev([cmp('BannerT', '>', '0')], [set('BannerT', '-', `${dt} / max(0.1, TimeScale())`)]),
    keyed('UiBar', 'flash', [opacity('UiBar', '160 * clamp(FlashT / 0.35, 0, 1)')]),
    ev([cmp('FlashT', '>', '0')], [set('FlashT', '-', dt)]),
    ev([cmp('SceneInstancesCount(Liar)', '>', '0')], [], [
      keyed('UiBar', 'boss', [width('UiBar', '596 * clamp(Liar.Hp / max(1, Liar.MaxHp), 0, 1) + 0.01'), opacity('UiBar', '255')]),
      keyed('UiBar', 'bossBg', [opacity('UiBar', '255')]),
    ]),
    ev([cmp('SceneInstancesCount(Liar)', '=', '0')], [], [
      keyed('UiBar', 'boss', [opacity('UiBar', '0')]),
      keyed('UiBar', 'bossBg', [opacity('UiBar', '0')]),
    ]),
    comment('Touch controls sit by the screen edges whatever the width.'),
    ev([], [
      A('SetXY', 'TouchStrike', '=', `${W} - 130`, '=', `${H} - 140`),
      A('SetXY', 'TouchPrayer', '=', `${W} - 290`, '=', `${H} - 110`),
      A('SetXY', 'TouchBreath', '=', `${W} - 260`, '=', `${H} - 270`),
      scale('TouchStrike', '0.8'), scale('TouchPrayer', '0.62'), scale('TouchBreath', '0.55'),
    ]),
  ]);
}
