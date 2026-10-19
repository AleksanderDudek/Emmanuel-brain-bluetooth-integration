/**
 * The game's data (Polish) for HolyHolyHoly 3D: the story and chapters (story.mjs), the archangels,
 * gifts, shadow-thoughts and thinking errors (game-data.mjs), plus what is shared with the 2D game
 * (web/game/src/content): the Fruits of the Spirit, the angelic ranks and the Gdańsk Bible.
 * build-content.mjs writes the result to project/assets/data/content.json, which the game loads
 * into the global variable `Content`.
 *
 * Verses are resolved here, so a wrong reference or a cut that does not match the text fails the
 * build instead of showing a broken quote. A reference may hold a man|woman alternative
 * ("{J 9,3|Mk 5,34}"); the quote then holds both texts the same way.
 */
import { BIBLE3D } from './bible.mjs';
import { CHAPTERS, PROLOGUE, FALL, HELPLINES, DISCLAIMER, SUPPORT, FINALE, HOW_TO } from './story.mjs';
import { HEROES, SKILLS, DISTORTIONS, ENEMIES } from './game-data.mjs';

/** Splits "{a|b}" alternatives into the man's and the woman's text. */
export function genderForms(text) {
  const pick = i => text.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_, m, f) => (i ? f : m));
  return [pick(0), pick(1)];
}

const hex = s => s.toLowerCase();
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = h => rgbOf(h).join(';');

/** Fruits of the Spirit (Ga 5,22-23): lasting talents bought with manna. Effects of the 3D game. */
const FRUIT_EFFECTS = {
  milosc: 'Każdy poziom dodaje jedno serce.',
  radosc: 'Każdy poziom daje o 10% więcej światła.',
  pokoj: 'Każdy poziom wydłuża o 15% zasięg daru archanioła.',
  cierpliwosc: 'Każdy poziom wydłuża serię ciosów o 0,25 s.',
  uprzejmosc: 'Każdy poziom przyciąga światło z 25% dalszej odległości.',
  dobroc: 'Każdy poziom wydłuża łaskę po ranie o 0,4 s.',
  wiernosc: 'Każdy poziom przyspiesza ładowanie Modlitwy o 15%.',
  lagodnosc: 'Każdy poziom zwiększa obrażenia o 8%.',
  opanowanie: 'Każdy poziom zwiększa o 10% szybkość daru, gdy stoisz w miejscu.',
};

/** The Ladder (St John Climacus): stations on the rungs, from the ground up to Christ. */
const RUNG = 128;
const ladderNode = i => ({ x: (i % 2 ? 1 : -1) * 70, y: 600 - i * RUNG });
function ladderPaths(count) {
  const top = 600 - (count - 1) * RUNG - 160;
  const beam = (x1, y1, x2, y2) => ({ cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, length: Math.round(Math.hypot(x2 - x1, y2 - y1)), angle: Math.round((Math.atan2(y2 - y1, x2 - x1) * 1800) / Math.PI) / 10 });
  return {
    top: { x: 0, y: top - 180 },
    paths: [
      beam(-150, 720, -150, top), beam(150, 720, 150, top),
      ...Array.from({ length: count }, (_, i) => beam(-150, 600 - i * RUNG, 150, 600 - i * RUNG)),
    ],
  };
}

export function makeContent(c) {
  const bible = ref => {
    const text = BIBLE3D[ref] ?? c.BIBLE[ref];
    if (!text) throw new Error(`Unknown Bible reference ${ref} (add it to tools/fetch-verses.py)`);
    return text;
  };
  /** A verse cut to the words between `from` and `to` (both kept), verbatim. */
  const cut = (ref, from, to) => {
    let text = bible(ref);
    if (from) {
      const i = text.indexOf(from);
      if (i < 0) throw new Error(`${ref}: "${from}" not in "${text}"`);
      text = text.slice(i);
    }
    if (to) {
      const i = text.indexOf(to);
      if (i < 0) throw new Error(`${ref}: "${to}" not in "${text}"`);
      text = text.slice(0, i + to.length);
    }
    // a cut quote ends as a sentence
    text = text.replace(/[;,:]$/, '');
    if (!/[.!?]$/.test(text)) text += '.';
    return text[0].toUpperCase() + text.slice(1);
  };
  /** {ref, from, to} → {ref, text}, with man|woman alternatives kept as "{a|b}". */
  const verse = v => {
    const [refM, refF] = genderForms(v.ref);
    const [fromM, fromF] = v.from ? genderForms(v.from) : [undefined, undefined];
    const [toM, toF] = v.to ? genderForms(v.to) : [undefined, undefined];
    const m = cut(refM, fromM, toM), f = cut(refF, fromF, toF);
    return { ref: refM === refF ? refM : `{${refM}|${refF}}`, text: m === f ? m : `{${m}|${f}}` };
  };
  const line = l => {
    const out = { who: l.who, text: l.text ?? '' };
    if (l.verse) {
      const v = verse(l.verse);
      out.quote = v.text;
      out.ref = v.ref;
    }
    out.panel = l.panel ?? '';
    return out;
  };
  /** Every line knows its panel: a scene keeps the last one until a line changes it. */
  const scene = lines => {
    let panel = '';
    return lines.map(line).map(l => {
      panel = l.panel || panel;
      return { ...l, panel };
    });
  };

  const distortions = Object.fromEntries(DISTORTIONS.map(d => [d.id, d]));
  const unlocks = Object.fromEntries(HEROES.filter(h => h.unlockedBy).map(h => [h.unlockedBy, h.id]));
  const ladder = ladderPaths(CHAPTERS.length);

  const chapters = CHAPTERS.map((ch, index) => {
    for (const kind of ch.enemies) if (!ENEMIES.some(e => e.kind === kind)) throw new Error(`${ch.id}: unknown enemy ${kind}`);
    for (const d of genderForms(ch.cbt.distortion)) if (!distortions[d]) throw new Error(`${ch.id}: unknown distortion ${d}`);
    if (ch.cbt.options.length !== 3) throw new Error(`${ch.id}: the thought record needs 3 options`);
    return {
      id: ch.id,
      index,
      title: ch.title,
      theme: ch.theme,
      place: ch.place,
      fact: ch.fact,
      warning: ch.warning,
      helplines: Boolean(ch.helplines),
      track: ch.track,
      floor: `assets/textures/${ch.floor}.jpg`,
      look: ch.look,
      enemies: ch.enemies,
      boss: { ...ch.boss, art: `Boss_${ch.id}` },
      story: { intro: scene(ch.story.intro), heal: scene(ch.story.heal) },
      cbt: {
        situation: ch.cbt.situation,
        thought: ch.boss.lie,
        feeling: ch.cbt.feeling,
        distortion: ch.cbt.distortion,
        // kind of each option, in the order written: distorted, sugar-coated, balanced
        options: ch.cbt.options.map((o, i) => ({ text: o.text, why: o.why, kind: ['distorted', 'sugar', 'balanced'][i] })),
        truth: ch.cbt.truth,
        verse: verse(ch.cbt.verse),
        helplines: Boolean(ch.cbt.helplines),
      },
      tool: { breathing: false, ...ch.tool },
      unlocks: unlocks[ch.id] ?? '',
      node: ladderNode(index),
      unlockedBy: index > 0 ? CHAPTERS[index - 1].id : '',
      unlockedByTitle: index > 0 ? CHAPTERS[index - 1].title : '',
    };
  });

  const skills = Object.fromEntries(SKILLS.map(s => [s.id, {
    id: s.id,
    kind: s.kind,
    hero: s.hero ?? '',
    name: s.name,
    description: s.description,
    maxLevel: s.levels.length,
    levels: s.levels,
    verse: s.verse ? verse(s.verse) : { ref: '', text: '' },
    icons: s.icons,
    consumable: Boolean(s.consumable),
    evolution: s.evolution
      ? { with: s.evolution.with, name: s.evolution.name, text: s.evolution.text, verse: verse(s.evolution.verse) }
      : { with: '', name: '', text: '', verse: { ref: '', text: '' } },
  }]));
  for (const s of Object.values(skills)) {
    if (s.evolution.with && skills[s.evolution.with]?.kind !== 'virtue') throw new Error(`${s.id}: evolves with ${s.evolution.with}, which is not a virtue`);
  }

  return {
    version: 2,
    title: {
      name: 'HolyHolyHoly 3D',
      subtitle: 'Archaniołowie',
      motto: { ref: '2 Kor 10,4', text: (c.BIBLE['2 Kor 10,4'] ?? '').replace(/^\((.*)\)$/, '$1') },
      verse: { ref: 'Iz 6,3', text: c.BIBLE['Iz 6,3'] },
    },
    story: {
      prologue: scene(PROLOGUE),
      howTo: HOW_TO,
      fall: { panel: FALL.panel, lines: FALL.lines, verses: FALL.verses.map(verse), button: FALL.button },
      finale: FINALE,
      disclaimer: DISCLAIMER,
      helplines: HELPLINES,
      helplinesText: HELPLINES.map(h => `${h.number}: ${h.text}`).join('\n'),
      helplinesShort: '116 123 · 800 70 2222 · 112',
      support: SUPPORT,
      names: { m: 'Adam', f: 'Ewa' },
    },
    heroes: HEROES.map((h, index) => ({ ...h, index, verse: verse(h.verse), skill: skills[h.signature].name, unlockedByTitle: CHAPTERS.find(c => c.id === h.unlockedBy)?.title ?? '' })),
    heroIndex: Object.fromEntries(HEROES.map((h, i) => [h.id, i])),
    skills,
    skillOrder: SKILLS.map(s => s.id),
    enemies: Object.fromEntries(ENEMIES.map(e => [e.kind, { ...e, color: hex(e.color), colorRgb: rgb(e.color), distortionName: distortions[e.distortion].name }])),
    enemyOrder: ENEMIES.map(e => e.kind),
    distortions,
    distortionOrder: DISTORTIONS.map(d => d.id),
    chapters,
    fruits: c.FRUITS.map(f => ({ id: f.id, name: f.name, effect: FRUIT_EFFECTS[f.id] ?? f.effect, verse: f.verse, maxLevel: f.maxLevel, costs: f.costs })),
    ranks: c.RANKS.map(r => ({ id: r.id, name: r.name, light: r.light, wings: r.wings, verse: r.verse, blessing: r.blessing })),
    ladder,
  };
}
