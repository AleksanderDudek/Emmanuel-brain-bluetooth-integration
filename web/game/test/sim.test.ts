import { describe, expect, it } from 'vitest';
import { blockedCells, computeField, fieldDirection, GW } from '../src/sim/flow';
import { DOOR, generateRoom, mergeWalls, ROOM_W, START, type RoomLayout } from '../src/sim/room';
import { BASE_POOL, MAX_LEVEL, modsFrom, Run } from '../src/sim/run';
import { World, type External } from '../src/sim/world';
import type { ChapterDef, TraumaBehavior, TraumaDef, TraumaKind } from '../src/types';

const KINDS: TraumaKind[] = ['lek', 'wstyd', 'gniew', 'rozpacz', 'odrzucenie', 'samotnosc', 'wina', 'nalog', 'pycha', 'zazdrosc', 'nieprzebaczenie', 'zwatpienie', 'kontrola', 'oskarzyciel'];
const BEHAVIOR: Partial<Record<TraumaKind, TraumaBehavior>> = { nalog: 'splitter', wina: 'tank', oskarzyciel: 'ranged', zwatpienie: 'blink', rozpacz: 'shy', gniew: 'erratic', wstyd: 'ambush' };
const DEFS = Object.fromEntries(KINDS.map(k => [k, {
  kind: k, name: k, behavior: BEHAVIOR[k] ?? 'chase', color: '#88aaff', hp: 20, speed: 2, truth: { word: `prawda-${k}`, verse: { ref: 'J 8,32', text: 'prawda' } },
} satisfies TraumaDef])) as Record<TraumaKind, TraumaDef>;

const CHAPTER: ChapterDef = {
  id: 'malkut', order: 0, title: 'Kołyska', sphere: { name: 'Malkut', meaning: 'Królestwo' }, story: 'x', verse: { ref: 'Ps 91,11', text: 'x' },
  palette: { bg1: '#222', bg2: '#111', accent: '#fd6', wall: '#444', seed: '#ffe' }, traumas: ['lek'], boss: { name: 'Twierdza', lie: 'kłamstwo', hp: 60 },
  revelationId: 'r', mode: 1, realm: 'earth', report: 'x',
};

const CALM: External = { peace: 0, spiritRate: 0, restRate: 0.2, revelation: false };
const mods = modsFrom({}, 0);
const run = (ch: ChapterDef = CHAPTER, pool = BASE_POOL) => new Run(ch, pool, mods, true, 1);

const emptyLayout = (kind: RoomLayout['kind'] = 'battle'): RoomLayout => ({
  kind, walls: [], solid: [], seeds: [], graces: [], spawns: [{ x: 4.5, y: 2 }], altar: kind === 'chapel' ? { x: 4.5, y: 6 } : null,
  fragmentSpots: [{ x: 2, y: 4 }, { x: 7, y: 4 }, { x: 4.5, y: 9 }], templateName: 'test',
});

/** A world with no scripted waves, so tests place shadows by hand. */
function quietWorld(kind: RoomLayout['kind'] = 'battle', r = run()): World {
  const w = new World({ run: r, layout: emptyLayout(kind), defs: DEFS, seed: 7 });
  (w as unknown as { waves: unknown[] }).waves = [];
  w.traumas = [];
  return w;
}

const steps = (w: World, seconds: number, mx = 0, my = 0, ext: External = CALM) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) w.step(1 / 60, mx, my, ext);
};

describe('rooms and flow fields', () => {
  it('generates reproducible rooms with a free door and no seeds at the start', () => {
    const a = generateRoom('battle', 42), b = generateRoom('battle', 42);
    expect(a).toEqual(b);
    expect(a.seeds.length).toBeGreaterThan(10);
    expect(a.seeds.every(s => !(Math.abs(s.x - START.x) < 1.6 && Math.abs(s.y - START.y) < 1.6))).toBe(true);
    expect(a.walls.every(w => !(w.y < 1 && w.x <= DOOR.x && w.x + w.w >= DOOR.x))).toBe(true);
    expect(generateRoom('sabbath', 1).walls.length).toBeGreaterThan(0);
  });

  it('merges wall cells into runs', () => {
    const solid = Array(9 * 15).fill(false);
    solid[0] = solid[1] = solid[2] = true;
    solid[9 + 4] = true;
    expect(mergeWalls(solid)).toEqual([{ x: 0, y: 0, w: 3, h: 1 }, { x: 4, y: 1, w: 1, h: 1 }]);
  });

  it('routes around a wall instead of through it', () => {
    const walls = [{ x: 2, y: 7, w: 5, h: 1 }];
    const blocked = blockedCells(walls);
    const field = computeField(blocked, 4.5, 4);
    const below = field[Math.floor(10 / 0.5) * GW + Math.floor(4.5 / 0.5)];
    expect(below).toBeGreaterThan(60);   // detour, not the 12 straight cells
    const [dx] = fieldDirection(field, blocked, 4.5, 8.6);
    expect(Math.abs(dx)).toBeGreaterThan(0.5);   // steps sideways around the wall
  });
});

describe('run', () => {
  it('levels up from light and offers gifts', () => {
    const r = run();
    r.addLight(r.xpNeed + 1);
    expect(r.level).toBe(2);
    expect(r.pendingLevelUps).toBe(1);
    const offers = r.offers();
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
    r.choose(offers[0]);
    expect(r.pendingLevelUps).toBe(0);
  });

  it('fills offers with rest when the pool is exhausted', () => {
    const r = run(CHAPTER, ['slowo']);
    r.gifts.set('slowo', MAX_LEVEL.slowo);
    expect(r.offers()).toEqual(['heal']);
  });
});

describe('world', () => {
  it('weakens a shadow with the Word only while standing still, then digests it', () => {
    const w = quietWorld();
    const t = w.spawnTrauma('lek', START.x, START.y - 4);
    t.state = 'normal';
    t.speed = 0;
    steps(w, 0.5, 1, 0);
    expect(w.shots.length).toBe(0);           // moving: no Word
    steps(w, 2.5);
    expect(t.state).toBe('weak');             // standing still: weakened, not killed
    expect(w.traumas).toContain(t);
    t.x = w.player.x; t.y = w.player.y;
    steps(w, 0.05);
    expect(w.traumas).not.toContain(t);
    expect(w.stomach).toHaveLength(1);
    const events = w.drainEvents();
    expect(events.some(e => e.type === 'eat')).toBe(true);
    steps(w, 1.2);                            // still → twice as fast (2 s → ~1 s)
    expect(w.stomach).toHaveLength(0);
    const after = w.drainEvents();
    expect(after.find(e => e.type === 'truth')).toMatchObject({ word: 'prawda-lek' });
    expect(after.some(e => e.type === 'verse')).toBe(true);
    expect(w.run.stats.digested.lek).toBe(1);
  });

  it('digests slower on the move', () => {
    const w = quietWorld();
    w.stomach.push({ kind: 'lek', p: 0, light: 5 });
    steps(w, 1.2, 0.6, 0);
    expect(w.stomach).toHaveLength(1);
  });

  it('grace makes every shadow edible and doubles the combo', () => {
    const w = quietWorld();
    for (let i = 0; i < 3; i++) { const t = w.spawnTrauma('lek', 1 + i * 3, 3); t.state = 'normal'; }
    w.startGrace(6);
    expect(w.traumas.every(t => t.state === 'fright')).toBe(true);
    const mults: number[] = [];
    for (const t of [...w.traumas]) {
      t.x = w.player.x; t.y = w.player.y;
      w.step(1 / 60, 0, 0, CALM);
      for (const e of w.drainEvents()) if (e.type === 'eat') mults.push(e.mult);
    }
    expect(mults).toEqual([1, 2, 4]);
  });

  it('opens the door when the shadows are digested and most seeds gathered', () => {
    const w = new World({ run: run(), layout: { ...emptyLayout(), seeds: [{ x: 1, y: 1 }, { x: 8, y: 1 }] }, defs: DEFS, seed: 1 });
    (w as unknown as { waves: unknown[] }).waves = [];
    w.traumas = [];
    for (const s of w.seeds) { w.player.x = s.x; w.player.y = s.y; steps(w, 0.05); }
    expect(w.doorOpen).toBe(true);
    w.player.x = DOOR.x; w.player.y = 0.5;
    steps(w, 0.05);
    expect(w.state).toBe('exit');
  });

  it('hurts on contact, falls at zero hearts, and the Helmet of Salvation lifts once', () => {
    const r = run();
    r.gifts.set('helm', 1);
    const w = quietWorld('battle', r);
    const t = w.spawnTrauma('lek', w.player.x, w.player.y);
    t.state = 'normal';
    t.speed = 0;
    w.player.iFrames = 0;
    r.hearts = 1;
    steps(w, 0.05);
    expect(r.hearts).toBe(2);   // revived
    expect(r.helmUsed).toBe(true);
    r.hearts = 1;
    w.player.iFrames = 0;
    t.x = w.player.x; t.y = w.player.y;
    steps(w, 0.05);
    expect(w.state).toBe('fallen');
    expect(r.stats.falls).toBe(1);
    const again = World.retry(w, 3);
    expect(again.state).toBe('playing');
    expect(r.hearts).toBe(r.maxHearts);
  });

  it('an addiction splits in two when weakened', () => {
    const w = quietWorld();
    const t = w.spawnTrauma('nalog', 4.5, 6);
    t.state = 'normal';
    w.damage(t, 999);
    const parts = w.traumas.filter(x => x.kind === 'nalog');
    expect(parts).toHaveLength(2);
    expect(parts.every(p => p.child && p.state === 'weak')).toBe(true);
  });

  it('the stronghold cracks, weakens its servants, and must be eaten', () => {
    const w = new World({ run: run(), layout: emptyLayout('boss'), defs: DEFS, seed: 5 });
    const minion = w.spawnTrauma('lek', 1, 1);
    minion.state = 'normal';
    const b = w.boss!;
    expect(b.hp).toBe(60);
    (w as unknown as { damageBoss(d: number): void }).damageBoss(100);
    expect(b.cracked).toBe(true);
    expect(minion.state).toBe('weak');
    w.player.x = b.x; w.player.y = b.y + b.r;
    steps(w, 0.05);
    expect(b.eaten).toBe(true);
    steps(w, 3);
    expect(w.state).toBe('bossDone');
  });

  it('the chapter ends once the stronghold is digested, and nothing hurts after it falls', () => {
    const r = run();
    const w = new World({ run: r, layout: emptyLayout('boss'), defs: DEFS, seed: 5 });
    const b = w.boss!;
    (w as unknown as { damageBoss(d: number): void }).damageBoss(100);
    w.player.x = b.x; w.player.y = b.y + b.r;
    steps(w, 0.05);
    expect(b.eaten).toBe(true);
    const minion = w.spawnTrauma('lek', w.player.x, w.player.y);
    minion.state = 'normal';
    minion.speed = 0;
    r.hearts = 1;
    w.player.iFrames = 0;
    const light = r.light;
    steps(w, 1.7, 0.5, 0);                    // on the move the stronghold digests slowly
    expect(w.state).toBe('playing');
    expect(r.hearts).toBe(1);
    steps(w, 8);
    expect(w.state).toBe('bossDone');
    expect(w.stomach).toHaveLength(0);
    expect(r.light).toBeGreaterThan(light);   // its Light was credited, not lost
  });

  it('the door waits until the stomach is empty', () => {
    const w = quietWorld();
    w.stomach.push({ kind: 'lek', p: 0, light: 5 });
    steps(w, 0.2);
    expect(w.doorOpen).toBe(false);
    steps(w, 1.2);
    expect(w.stomach).toHaveLength(0);
    expect(w.doorOpen).toBe(true);
  });

  it('leaving a room never loses an undigested meal', () => {
    const w = quietWorld();
    w.doorOpen = true;
    w.stomach.push({ kind: 'lek', p: 0, light: 10 });
    const light = w.run.light;
    w.player.x = DOOR.x; w.player.y = 0.5;
    steps(w, 1 / 60);
    expect(w.state).toBe('exit');
    expect(w.stomach).toHaveLength(0);
    expect(w.run.light).toBeGreaterThan(light);
    expect(w.run.stats.digested.lek).toBe(1);
  });

  it('a fall in the doorway is not overwritten by the exit', () => {
    const r = run();
    const w = quietWorld('battle', r);
    w.doorOpen = true;
    r.hearts = 1;
    w.player.iFrames = 0;
    w.player.x = DOOR.x; w.player.y = 0.5;
    const t = w.spawnTrauma('lek', DOOR.x, 0.5);
    t.state = 'normal';
    t.speed = 0;
    steps(w, 1 / 60);
    expect(w.state).toBe('fallen');
  });

  it('starting a room over after a fall re-earns its Light instead of counting it twice', () => {
    const r = run();
    r.light = 100;
    const w = quietWorld('battle', r);
    r.addLight(50);
    r.stats.digested.lek = 3;
    r.stats.seeds = 7;
    r.stats.fragments = 1;
    r.stats.falls = 1;
    const again = World.retry(w, 3);
    expect(r.light).toBe(100);
    expect(r.stats.digested).toEqual({});
    expect(r.stats.seeds).toBe(0);
    expect(r.stats.fragments).toBe(0);
    expect(r.stats.falls).toBe(1);
    expect(r.stats.fragmentsTotal).toBe(again.fragments.length);
  });

  it('a revelation strikes the stronghold harder', () => {
    const w = new World({ run: run(), layout: emptyLayout('boss'), defs: DEFS, seed: 5 });
    w.boss!.revealCd = 0;
    w.boss!.arrowCd = 99;
    w.step(1 / 60, 0, 0, { ...CALM, revelation: true });
    expect(w.boss!.revealT).toBeGreaterThan(5);
    const hp = w.boss!.hp;
    (w as unknown as { damageBoss(d: number): void }).damageBoss(10);
    expect(hp - w.boss!.hp).toBeCloseTo(15);
  });

  it('the Sabbath restores hearts and blesses a full rest', () => {
    const r = run();
    r.hearts = 1;
    const w = quietWorld('sabbath', r);
    expect(w.doorOpen).toBe(true);
    steps(w, 21, 0, 0, { ...CALM, restRate: 0.2 });
    expect(w.sabbathBlessed).toBe(true);
    expect(r.hearts).toBe(r.maxHearts);
    expect(r.spirit).toBe(100);
  });

  it('the chapel altar pauses for a focus task and blesses success', () => {
    const r = run();
    const w = quietWorld('chapel', r);
    w.player.x = 4.5; w.player.y = 6;
    steps(w, 0.05);
    expect(w.state).toBe('chapel');
    w.blessChapel(true);
    expect(w.state).toBe('playing');
    expect(r.auraBlessing).toBeGreaterThan(0);
    const aura = r.auraBlessing, spirit = r.spirit;
    w.blessChapel(true);                      // a second result for the same altar changes nothing
    expect(r.auraBlessing).toBe(aura);
    expect(r.spirit).toBe(spirit);
  });

  it('a chained soul fragment is freed by standing still beside it', () => {
    const w = new World({ run: run({ ...CHAPTER, realm: 'hell' }), layout: emptyLayout('rescue'), defs: DEFS, seed: 2 });
    (w as unknown as { waves: unknown[] }).waves = [];
    w.traumas = [];
    const f = w.fragments[0];
    expect(f.chained).toBe(true);
    w.player.x = f.x + 0.8; w.player.y = f.y;
    steps(w, 3);
    expect(f.alive).toBe(false);
    expect(w.run.stats.fragments).toBe(1);
  });

  it('the Spirit charges and Pentecost makes all shadows edible', () => {
    const r = run();
    const w = quietWorld('battle', r);
    const t = w.spawnTrauma('lek', 2, 2);
    t.state = 'normal';
    steps(w, 1, 0, 0, { ...CALM, spiritRate: 120 });
    expect(r.spirit).toBe(100);
    expect(w.triggerUltimate()).toBe(true);
    expect(t.state).toBe('fright');
    expect(w.pentecostT).toBeGreaterThan(6);
  });

  it('runs a full battle room deterministically without errors', () => {
    const play = () => {
      const r = run();
      const w = new World({ run: r, layout: generateRoom('battle', 99), defs: DEFS, seed: 99 });
      for (let i = 0; i < 60 * 40; i++) {
        const phase = Math.floor(i / 90) % 2;
        w.step(1 / 60, phase ? Math.sin(i / 50) : 0, phase ? Math.cos(i / 70) : 0, CALM);
        if (w.state === 'levelup') { r.choose(r.offers()[0]); w.resume(); }
        if (w.state === 'fallen') break;
      }
      return [w.time, r.light, w.traumas.length, w.player.x.toFixed(4)].join('|');
    };
    expect(play()).toBe(play());
    expect(ROOM_W).toBe(9);
  });
});
