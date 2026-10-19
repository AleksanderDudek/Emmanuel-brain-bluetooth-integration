import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as source from '../../game/src/content';
import { makeContent, genderForms } from '../tools/content.mjs';
import { ASSETS, GAME3D } from '../tools/paths.mjs';

interface Line { who: string; text: string; quote?: string; ref?: string; panel: string }
interface Option { text: string; why: string; kind: string }
interface Chapter {
  id: string; title: string; theme: string; place: string; fact: string; warning: string; helplines: boolean; track: string; floor: string;
  enemies: string[]; unlockedBy: string; unlocks: string; node: { x: number; y: number };
  boss: { name: string; lie: string; hp: number; art: string };
  story: { intro: Line[]; heal: Line[] };
  cbt: { situation: string; thought: string; distortion: string; options: Option[]; truth: string; verse: { ref: string; text: string }; helplines: boolean };
  tool: { id: string; name: string; steps: string[]; practice: string; evidence: string; breathing: boolean };
  look: Record<string, string>;
}
interface Skill { id: string; kind: string; hero: string; maxLevel: number; levels: string[]; icons: string[]; evolution: { with: string; name: string; text: string } }
interface Hero { id: string; name: string; tradition: string; signature: string; unlockedBy: string; stats: Record<string, number>; ultimate: { name: string } }
interface Enemy { kind: string; distortion: string; archetype: string; thoughts: string[]; reframes: string[]; angel: string[]; colorRgb: string }
interface Content {
  chapters: Chapter[]; heroes: Hero[]; skills: Record<string, Skill>; enemies: Record<string, Enemy>; distortions: Record<string, { name: string; question: string }>;
  story: { prologue: Line[]; helplines: { number: string }[]; support: { url: string }; fall: { verses: { ref: string; text: string }[] } };
  ladder: { paths: { cx: number; cy: number; length: number; angle: number }[]; top: { x: number; y: number } };
}

const committed = JSON.parse(readFileSync(join(ASSETS, 'data/content.json'), 'utf8')) as Content;
const manifest = JSON.parse(readFileSync(join(GAME3D, 'art/manifest.json'), 'utf8')) as { items: { id: string; out: string }[] };
const painted = new Set(manifest.items.map(i => i.out));
const rgb = /^\d{1,3};\d{1,3};\d{1,3}$/;

/** What the game shows (HolyHoly::G): the name first, then the man's or the woman's forms. */
const resolve = (text: string, gender: 'm' | 'f') => genderForms(text.replace(/\{imie\}/g, gender === 'm' ? 'Adam' : 'Ewa'))[gender === 'm' ? 0 : 1];
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => strings(v, out));
  return out;
}

describe('content.json (the data the GDevelop project loads)', () => {
  it('is up to date with the story, the game data and the 2D game content (npm run game3d:content)', () => {
    expect(JSON.parse(JSON.stringify(makeContent(source as unknown as Record<string, unknown>)))).toEqual(committed);
  });

  it('every text resolves cleanly for a man and for a woman', () => {
    for (const text of strings(committed)) {
      for (const g of ['m', 'f'] as const) expect(resolve(text, g), text).not.toMatch(/[{}|]/);
    }
    const intro = committed.chapters[0].story.intro[0].text;
    expect(resolve(intro, 'm')).toContain('Adam');
    expect(resolve(intro, 'f')).toContain('Ewa');
    expect(resolve('Jestem {kochany|kochana}', 'f')).toBe('Jestem kochana');
  });

  it('every chapter climbs the Ladder, with its story, its stronghold, its thought record and its tool', () => {
    const ids = committed.chapters.map(c => c.id);
    expect(ids).toHaveLength(10);
    committed.chapters.forEach((c, i) => {
      expect(c.unlockedBy).toBe(i === 0 ? '' : ids[i - 1]);
      expect(c.story.intro.length).toBeGreaterThanOrEqual(3);
      expect(c.story.heal.length).toBeGreaterThanOrEqual(4);
      expect(c.cbt.options.map(o => o.kind)).toEqual(['distorted', 'sugar', 'balanced']);
      for (const g of ['m', 'f'] as const) expect(committed.distortions[resolve(c.cbt.distortion, g)], c.id).toBeDefined();
      expect(c.cbt.thought).toBe(c.boss.lie);
      expect(c.cbt.verse.text.length).toBeGreaterThan(10);
      expect(c.tool.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.tool.practice.length).toBeGreaterThan(20);
      expect(c.tool.evidence).toMatch(/\d{4}|EZOP|Beck|Burns/);
      expect(c.fact.length).toBeGreaterThan(40);
      for (const v of Object.values(c.look)) expect(v).toMatch(rgb);
      for (const k of c.enemies) expect(committed.enemies[k], `${c.id} → ${k}`).toBeDefined();
    });
  });

  it('every story panel, model, floor and icon the content names is in the art manifest', () => {
    const panels = new Set(committed.chapters.flatMap(c => [...c.story.intro, ...c.story.heal]).concat(committed.story.prologue).map(l => l.panel));
    for (const panel of panels) for (const g of ['m', 'f'] as const) expect(painted.has(`story/${resolve(panel, g)}.webp`), panel).toBe(true);
    for (const c of committed.chapters) {
      expect(painted.has(c.floor.replace('assets/', '')), c.floor).toBe(true);
      expect(painted.has(`bosses/${c.id}.webp`), c.id).toBe(true);
    }
    for (const h of committed.heroes) {
      expect(painted.has(`heroes/${h.id}.webp`)).toBe(true);
      expect(painted.has(`heroes/${h.id}-icon.webp`)).toBe(true);
      expect(painted.has(`skills/ult-${h.id}.webp`)).toBe(true);
    }
    for (const s of Object.values(committed.skills)) for (const icon of s.icons) expect(painted.has(`skills/${icon}.webp`), icon).toBe(true);
    for (const kind of Object.keys(committed.enemies)) expect(painted.has(`enemies/${kind}.webp`), kind).toBe(true);
  });

  it('Christ speaks only His own words from Scripture, always with the reference', () => {
    const lines = committed.chapters.flatMap(c => [...c.story.intro, ...c.story.heal]);
    const christ = lines.filter(l => l.who === 'christ');
    expect(christ.length).toBeGreaterThanOrEqual(10);
    for (const l of christ) {
      expect(l.text).toBe('');
      expect(l.quote!.length).toBeGreaterThan(5);
      expect(l.ref).toMatch(/\d+,\d+/);
    }
    // and He comes in every chapter's healing
    for (const c of committed.chapters) expect(c.story.heal.some(l => l.who === 'christ' || /Jezus|Chrystus/.test(l.text)), c.id).toBe(true);
  });

  it('the seven archangels: two open at first, the rest join along the Ladder, each with his own gift', () => {
    expect(committed.heroes.map(h => h.id)).toEqual(['uriel', 'michal', 'gabriel', 'rafal', 'selafiel', 'barachiel', 'jehudiel']);
    expect(committed.heroes.filter(h => h.unlockedBy === '').map(h => h.id)).toEqual(['uriel', 'michal']);
    for (const h of committed.heroes) {
      expect(committed.skills[h.signature].hero).toBe(h.id);
      if (h.unlockedBy) expect(committed.chapters.find(c => c.id === h.unlockedBy)?.unlocks).toBe(h.id);
      expect(['wspólna', 'wschodnia']).toContain(h.tradition);
    }
    // the Latin Church names only these three; the others are named "in the Eastern tradition"
    expect(committed.heroes.filter(h => h.tradition === 'wspólna').map(h => h.id).sort()).toEqual(['gabriel', 'michal', 'rafal']);
  });

  it('gifts describe every level; each evolution needs a virtue', () => {
    for (const s of Object.values(committed.skills)) {
      expect(s.levels).toHaveLength(s.maxLevel);
      if (s.kind !== 'virtue') {
        expect(s.icons).toHaveLength(3);
        expect(committed.skills[s.evolution.with]?.kind, s.id).toBe('virtue');
        expect(s.evolution.text.length).toBeGreaterThan(10);
      }
    }
  });

  it('shadows are thoughts: each whispers, and breaks into the person\'s words and the angel\'s', () => {
    for (const e of Object.values(committed.enemies)) {
      expect(committed.distortions[e.distortion], e.kind).toBeDefined();
      expect(['chase', 'circle', 'charge', 'drift', 'tank', 'split', 'blink', 'ranged', 'gentle']).toContain(e.archetype);
      expect(e.colorRgb).toMatch(rgb);
      expect(e.thoughts.length).toBeGreaterThanOrEqual(2);
      expect(e.reframes.length).toBeGreaterThanOrEqual(3);
      expect(e.angel.length).toBeGreaterThanOrEqual(1);
      // global words of worth come from the angel ("Jesteś…"), never as a claim the person must make
      for (const r of e.reframes) expect(r, e.kind).not.toMatch(/^Jesteś/);
      expect(existsSync(join(ASSETS, `models/enemy-${e.kind}.glb`)), e.kind).toBe(true);
    }
    expect(committed.enemies.tesknota.archetype).toBe('gentle'); // grief is accompanied, not fought
  });

  it('keeps people safe: real help lines, a crisis chapter told as a way out, no method, no victim blaming', () => {
    const numbers = committed.story.helplines.map(h => h.number);
    for (const n of ['116 123', '800 70 2222', '116 111', '112']) expect(numbers).toContain(n);
    const crisis = committed.chapters.find(c => c.id === 'ciemnosc')!;
    expect(crisis.helplines && crisis.cbt.helplines).toBe(true);
    expect(crisis.warning).toContain('116 123');
    expect(crisis.story.intro.some(l => l.text.includes('116 123'))).toBe(true);
    expect(crisis.story.heal.some(l => /Marka|siostr/.test(l.text))).toBe(true); // help comes through people
    const all = strings(committed).join(' ');
    expect(all).not.toMatch(/popełni\w* samobój|zjad|pochł/i);
    const violence = committed.chapters.find(c => c.id === 'rana')!;
    expect(violence.warning).toMatch(/pominąć/);
    expect(violence.cbt.truth).toMatch(/odpowiada ten, kto jej używa/);
  });

  it('support goes to the author\'s page', () => {
    expect(committed.story.support.url).toBe('https://buymeacoffee.com/atd_uriel');
  });

  it('the Ladder: rails, a rung per chapter, Christ above the last one', () => {
    expect(committed.ladder.paths).toHaveLength(2 + committed.chapters.length);
    const last = committed.chapters[committed.chapters.length - 1].node;
    expect(committed.ladder.top.y).toBeLessThan(last.y);
  });
});
