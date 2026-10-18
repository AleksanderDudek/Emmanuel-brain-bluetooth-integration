import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as source from '../../game/src/content';
import { makeContent } from '../tools/content.mjs';
import { TRAUMA_COLORS, TRAUMA_SHAPES } from '../tools/palette.mjs';
import { ASSETS } from '../tools/paths.mjs';

interface Chapter {
  id: string; title: string; traumas: string[]; unlockedBy: string; node: { x: number; y: number };
  boss: { lie: string; hp: number }; revelation: { lie: string; truth: string; verses: { ref: string; text: string }[] };
  look: Record<string, string>;
}
interface Gift { id: string; kind: string; maxLevel: number; levels: string[]; verse: { ref: string; text: string } }
interface Content {
  chapters: Chapter[]; traumas: Record<string, { color: string; colorRgb: string; shape: string; archetype: string; truth: string; hp: number; speed: number }>;
  gifts: Gift[]; fruits: { id: string; maxLevel: number; costs: number[] }[]; ranks: { light: number; wings: number }[];
  story: { intro: string[]; fall: string[]; finale: string[]; howTo: string[] };
  tree: { paths: { cx: number; cy: number; length: number; angle: number }[] };
}

const committed = JSON.parse(readFileSync(join(ASSETS, 'data/content.json'), 'utf8')) as Content;
const rgb = /^\d{1,3};\d{1,3};\d{1,3}$/;

describe('content.json (the data the GDevelop project loads)', () => {
  it('is up to date with the 2D game content (npm run game3d:content)', () => {
    expect(JSON.parse(JSON.stringify(makeContent(source as unknown as Record<string, unknown>)))).toEqual(committed);
  });

  it('uses only traumas that exist, each with its 3D model and colours', () => {
    const kinds = Object.keys(committed.traumas);
    expect(kinds.sort()).toEqual(Object.keys(TRAUMA_COLORS).sort());
    for (const [kind, t] of Object.entries(committed.traumas)) {
      expect(parseInt(t.color.slice(1), 16), kind).toBe(TRAUMA_COLORS[kind]);
      expect(t.colorRgb).toMatch(rgb);
      expect(t.shape).toBe(TRAUMA_SHAPES[kind]);
      expect(['chase', 'circle', 'charge', 'drift', 'tank', 'split', 'blink', 'ranged']).toContain(t.archetype);
      expect(existsSync(join(ASSETS, `models/trauma-${kind}.glb`)), kind).toBe(true);
      expect(t.truth.length).toBeGreaterThan(2);
    }
    for (const ch of committed.chapters) for (const k of ch.traumas) expect(kinds, `${ch.id} → ${k}`).toContain(k);
  });

  it('every chapter can be reached and carries its lie, truth and colours', () => {
    const ids = committed.chapters.map(c => c.id);
    const open = new Set(committed.chapters.filter(c => c.unlockedBy === '').map(c => c.id));
    expect(open.size).toBe(1);
    for (let pass = 0; pass < ids.length; pass++) for (const c of committed.chapters) if (open.has(c.unlockedBy)) open.add(c.id);
    expect([...open].sort()).toEqual([...ids].sort());
    for (const c of committed.chapters) {
      expect(c.boss.lie).toBe(c.revelation.lie);
      expect(c.revelation.truth.length).toBeGreaterThan(40);
      expect(c.revelation.verses.length).toBeGreaterThan(0);
      for (const value of Object.values(c.look)) expect(value).toMatch(rgb);
    }
  });

  it('gifts describe every level and the run starts with the Sword of the Spirit', () => {
    expect(committed.gifts[0].id).toBe('slowo');
    for (const g of committed.gifts) {
      expect(g.levels).toHaveLength(g.maxLevel);
      expect(g.verse.ref).toMatch(/\d/);
    }
  });

  it('the tree paths join spheres of the tree', () => {
    const nodes = committed.chapters.map(c => c.node);
    for (const p of committed.tree.paths) {
      const ends = nodes.filter(n => Math.abs(Math.hypot(n.x - p.cx, n.y - p.cy) - p.length / 2) < 1);
      expect(ends.length, JSON.stringify(p)).toBeGreaterThanOrEqual(2);
    }
  });

  it('tells nothing about eating: the 3D game destroys traumas', () => {
    const texts = JSON.stringify({ intro: committed.story.intro, howTo: committed.story.howTo, gifts: committed.gifts });
    expect(texts).not.toMatch(/zjad|zjeść|pochł|trawi/i);
  });
});
