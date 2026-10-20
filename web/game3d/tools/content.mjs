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

/**
 * Times of day of a stage: the light of the chapter is mixed toward these colours, and the fog
 * draws nearer at night (mod "dark" brings it nearer still). Distances suit the Arena camera.
 */
const SKIES = {
  day: { sky: '255;250;240', fog: '118;116;126', ground: '110;100;96', floor: '205;200;192', mix: 0.45, distance: 1.1 },
  evening: { sky: '255;206;150', fog: '70;48;40', ground: '120;84;60', floor: '196;164;132', mix: 0.42, distance: 1 },
  dusk: { sky: '226;176;206', fog: '50;36;58', ground: '90;64;90', floor: '156;134;156', mix: 0.42, distance: 0.95 },
  night: { sky: '150;170;232', fog: '12;16;36', ground: '40;44;70', floor: '112;118;146', mix: 0.48, distance: 0.85 },
  deep: { sky: '112;112;176', fog: '6;6;18', ground: '24;24;44', floor: '82;82;108', mix: 0.58, distance: 0.75 },
};
const MODS = ['', 'swarm', 'heavy', 'dark', 'voices'];
/** The three answers of a thought record, in the order they are written and shown. */
const KINDS = [
  { id: 'distorted', name: 'Zniekształcona: utrwala kłamstwo' },
  { id: 'sugar', name: 'Lukrowana: brzmi pięknie, ale nie wytrzyma zderzenia z życiem' },
  { id: 'balanced', name: 'Zrównoważona: prawdziwa i pomocna' },
];
const FOG = { near: 2300, far: 5400 };
const mixRgb = (a, b, t) => {
  const [x, y] = [a, b].map(c => c.split(';').map(Number));
  return x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(';');
};
const minutes = clock => {
  const m = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`bad clock ${clock}`);
  return +m[1] * 60 + +m[2];
};

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
    if (ch.stages.length !== 3) throw new Error(`${ch.id}: a chapter has 3 stages`);
    const stages = ch.stages.map((st, i) => {
      if (!SKIES[st.sky]) throw new Error(`${ch.id} stage ${i + 1}: unknown sky ${st.sky}`);
      if (!MODS.includes(st.mod)) throw new Error(`${ch.id} stage ${i + 1}: unknown mod ${st.mod}`);
      for (const kind of st.enemies) if (!ch.enemies.includes(kind)) throw new Error(`${ch.id} stage ${i + 1}: ${kind} is not a shadow of this chapter`);
      if (st.memories.length !== 2) throw new Error(`${ch.id} stage ${i + 1}: a stage has 2 memories`);
      for (const clock of st.clock) for (const form of genderForms(clock)) minutes(form);
      const sky = SKIES[st.sky], dark = st.mod === 'dark' ? 0.55 : 1;
      const fog = mixRgb(ch.look.fog, sky.fog, sky.mix);
      return {
        index: i, clock: st.clock, title: st.title, sky: st.sky, mod: st.mod, enemies: st.enemies, caption: st.caption, memories: st.memories,
        look: {
          background: fog, fog, sky: mixRgb(ch.look.sky, sky.sky, sky.mix), ground: mixRgb(ch.look.ground, sky.ground, sky.mix), floor: mixRgb(ch.look.floor, sky.floor, sky.mix),
          near: Math.round(FOG.near * sky.distance * dark), far: Math.round(FOG.far * sky.distance * dark),
        },
      };
    });
    if (ch.voices.length < 4) throw new Error(`${ch.id}: a chapter needs at least 4 voices`);
    const voices = ch.voices.map((vc, i) => {
      for (const kind of genderForms(vc.kind)) if (!ch.enemies.includes(kind)) throw new Error(`${ch.id} voice ${i + 1}: ${kind} is not a shadow of this chapter`);
      for (const d of genderForms(vc.pattern)) if (!distortions[d]) throw new Error(`${ch.id} voice ${i + 1}: unknown pattern ${d}`);
      return { index: i, kind: vc.kind, says: vc.says, pattern: vc.pattern, no: vc.no, yes: vc.yes };
    });
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
      stages,
      voices,
      cbt: {
        situation: ch.cbt.situation,
        thought: ch.boss.lie,
        feeling: ch.cbt.feeling,
        distortion: ch.cbt.distortion,
        // kind of each option, in the order written: distorted, sugar-coated, balanced
        options: ch.cbt.options.map((o, i) => ({ text: o.text, why: o.why, kind: KINDS[i].id, kindName: KINDS[i].name })),
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
      motto: verse({ ref: '2 Kor 10,5', from: 'podbijając' }),
      verse: { ref: 'Iz 6,3', text: c.BIBLE['Iz 6,3'] },
    },
    story: {
      prologue: scene(PROLOGUE),
      howTo: HOW_TO,
      howToText: HOW_TO.join('\n\n'),
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
