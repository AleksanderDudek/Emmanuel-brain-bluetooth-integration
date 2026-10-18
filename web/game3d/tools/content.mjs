/**
 * The game's data (Polish) for HolyHolyHoly 3D, made from the 2D game's content
 * (web/game/src/content): chapters, traumas, gifts, Fruits of the Spirit, ranks and story.
 * Scripture, chapters, lies and revelations are shared, so both games tell the same story; what
 * is new in 3D (the gifts, which fight instead of eating, the intro, the arena colours) is here.
 * build-content.mjs writes the result to project/assets/data/content.json.
 */
import { TRAUMA_SHAPES } from './palette.mjs';
import { TREE_NODES, TREE_PATHS } from './tree-layout.mjs';

/** How each trauma moves in 3D (the 2D game's behaviours, without the maze-ghost personalities). */
const ARCHETYPE = { chase: 'chase', ambush: 'circle', erratic: 'charge', shy: 'drift', tank: 'tank', splitter: 'split', blink: 'blink', ranged: 'ranged' };

/** Side realms open after a chapter of the ascent (in 2D a prayer opened them). */
const UNLOCKED_BY = { rod: 'gewura', szeol: 'bina' };

const INTRO = [
  '„Aniołom swoim przykazał o tobie, aby cię strzegli na wszystkich drogach twoich” (Ps 91,11). Dziś Bóg powierza ci człowieka. Ma na imię Adam.',
  'Rany Adama stały się cieniami, które szepczą mu kłamstwa. Za nimi stoją twierdze: kłamstwa, w które uwierzył.',
  'Stań w ciszy, a Słowo uderzy w cienie. Rozbij je, a każda rana stanie się prawdą. Skupienie rozpala Ogień Ducha, a twierdze padają.',
];

const HOW_TO = [
  'Ruch: WASD / strzałki albo lewy kciuk. Gdy stoisz, Słowo samo leci w najbliższy cień.',
  'Cios Samsona: spacja / J albo przycisk z gwiazdą. Uderzaj seriami, zanim cień podejdzie. Pudło przerywa serię.',
  'Ogień Ducha: E / K albo przycisk z płomieniem. Skupienie (bezruch albo opaska Mendi) napełnia trzy płomienie.',
];

/** Gifts of a run (1 of 3 at each level). `weapon`s act by themselves; the rest change the angel. */
const GIFTS = [
  ['slowo', 'weapon', 5, 'Słowo Boże jest mieczem Ducha: gdy stoisz w ciszy, anioł mówi Słowem, a cienie pękają.',
    ['Słowo leci w najbliższy cień, gdy stoisz', '+30% obrażeń', '+25% szybkostrzelności', 'Słowo przebija jeden cień', '+30% obrażeń i szybsze Słowo']],
  ['chleby', 'weapon', 4, 'Jak pięć chlebów nakarmiło tysiące, tak jedno Słowo rozmnaża się w wachlarz światła.',
    ['2 Słowa naraz', '3 Słowa naraz', '4 Słowa naraz', '5 Słów naraz']],
  ['tarcza', 'weapon', 4, 'Tarcza wiary gasi ogniste strzały złego: krąży wokół anioła i rozbija cienie, które podejdą.',
    ['1 tarcza krąży wokół anioła', '2 tarcze', '3 tarcze, szybciej', '4 tarcze, mocniej']],
  ['ogien', 'weapon', 5, 'W dniu Pięćdziesiątnicy Duch zstąpił jak języki ognia; teraz płomień otacza anioła.',
    ['Płomienie parzą cienie tuż obok', 'Szerszy krąg', 'Mocniejszy ogień', 'Szerszy krąg', 'Częstszy i mocniejszy ogień']],
  ['wicher', 'weapon', 4, 'Szum gwałtownego wichru napełnił dom w dniu Pięćdziesiątnicy; teraz ten wiatr odpycha cienie.',
    ['Co 6 s wicher odrzuca cienie', 'Co 5 s', 'Co 4 s, dalej', 'Co 3 s, z obrażeniami']],
  ['golebica', 'weapon', 4, 'Nad Jordanem Duch zstąpił jak gołębica; teraz leci przy aniele i sama odnajduje cienie.',
    ['Gołębica uderza co 1,6 s', 'Co 1,3 s', 'Mocniej', 'Co 1 s, mocniej']],
  ['eliasz', 'weapon', 4, 'Na górze Karmel ogień Pański spadł z nieba na modlitwę Eliasza; teraz spada na cienie.',
    ['Co 4 s ogień z nieba', 'Większy płomień', 'Co 3 s', 'Dwa płomienie naraz']],
  ['jerycho', 'weapon', 3, 'Mury Jerycha upadły od głosu trąb; ta fala gasi strzały i zatrzymuje cienie.',
    ['Co 8 s fala zatrzymuje cienie na 1,5 s', 'Co 7 s, na 2 s', 'Co 6 s, z obrażeniami']],
  ['dawid', 'weapon', 4, 'Mały Dawid jednym kamieniem z procy powalił olbrzyma; ten kamień zawsze leci w najsilniejszego.',
    ['Co 3 s kamień w najsilniejszy cień', 'Mocniejszy kamień', 'Co 2,2 s', 'Kamień przebija i rani twierdze podwójnie']],
  ['samson', 'strike', 4, 'Samson modlił się: „zmocnij mię proszę tylko ten raz” (Sdz 16,28). Twój cios odrzuca cienie.',
    ['+40% siły ciosu', 'Dłuższy zasięg ciosu', '+40% siły ciosu', 'Cios odpycha też cienie wokół']],
  ['manna', 'heal', 3, 'Bóg karmił swój lud manną z nieba każdego dnia; tak samo odnawia twoje siły.',
    ['Odnawia jedno serce', 'Odnawia jedno serce', 'Odnawia dwa serca']],
  ['sandaly', 'passive', 3, 'Nogi obute w gotowość Ewangelii pokoju niosą anioła szybciej.',
    ['+12% szybkości', '+12% szybkości', '+12% szybkości']],
  ['pancerz', 'passive', 3, 'Pancerz sprawiedliwości, nie twojej, lecz Bożej, chroni serce przed ranami.',
    ['12% szans uniknięcia rany', '24% szans', '36% szans']],
  ['helm', 'passive', 1, 'Hełm zbawienia strzeże myśli; gdy wszystko wydaje się stracone, przypomina, że należysz do Boga.',
    ['Raz w rozdziale podnosi cię od razu z dwoma sercami']],
  ['ucisz', 'passive', 3, 'Jezus zgromił wiatr i rzekł morzu: „Umilknij, a uśmierz się” (Mk 4,39); gdy cię zranią, burza zamiera.',
    ['Po ranie cienie obok zamierają na 1,5 s', 'Na 2,5 s', 'Na 3,5 s, w szerszym kręgu']],
  ['milosc', 'passive', 3, 'Doskonała miłość usuwa lęk; im więcej miłości, tym słabsze cienie.',
    ['Cienie mają 10% mniej sił', '20% mniej', '30% mniej']],
  ['ryba', 'passive', 3, 'Bóg posłał wielką rybę, która ocaliła Jonasza; tak światło samo płynie do anioła z daleka.',
    ['+40% zasięgu przyciągania światła', '+80%', '+120%']],
  ['serce', 'passive', 2, 'Bóg obiecał zabrać serce z kamienia i dać serce z ciała.',
    ['+1 serce', '+1 serce']],
  ['przebaczenie', 'passive', 3, 'Siedemdziesiąt siedem razy (Mt 18,22): łaska trwa dłużej, a seria ciosów nie gaśnie tak szybko.',
    ['+0,4 s łaski po ranie, dłuższa seria', '+0,8 s', '+1,2 s']],
];

/** Fruits of the Spirit (Ga 5,22-23): lasting talents bought with manna. Effects adapted to 3D. */
const FRUIT_EFFECTS = {
  milosc: 'Każdy poziom dodaje jedno serce.',
  radosc: 'Każdy poziom daje o 10% więcej światła.',
  pokoj: 'Każdy poziom wydłuża o 15% zasięg Słowa.',
  cierpliwosc: 'Każdy poziom wydłuża serię ciosów o 0,25 s.',
  uprzejmosc: 'Każdy poziom przyciąga światło z 25% dalszej odległości.',
  dobroc: 'Każdy poziom wydłuża łaskę po ranie o 0,4 s.',
  wiernosc: 'Każdy poziom przyspiesza ładowanie Ognia Ducha o 15%.',
  lagodnosc: 'Każdy poziom zwiększa obrażenia o 8%.',
  opanowanie: 'Każdy poziom zwiększa o 10% szybkostrzelność, gdy stoisz w miejscu.',
};

const hex = s => s.toLowerCase();
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** "r;g;b" — the colour format of GDevelop actions. */
const rgb = h => rgbOf(h).join(';');
/** Mix two #rrggbb colours (t = 0 → a, 1 → b), as "r;g;b". */
const mix = (a, b, t) => rgbOf(a).map((x, i) => Math.round(x + (rgbOf(b)[i] - x) * t)).join(';');

/** The colours of a chapter's arena, derived from the 2D palette (dark backgrounds, an accent). */
const look = p => ({
  background: rgb(p.bg1),
  fog: rgb(p.bg2),
  floor: mix(p.accent, '#8a847c', 0.55),
  rim: rgb(p.accent),
  sky: mix(p.seed, '#ffffff', 0.4),
  ground: mix(p.wall, '#000000', 0.2),
});

export function makeContent(c) {
  const revelation = id => {
    const r = c.REVELATIONS.find(x => x.id === id);
    if (!r) throw new Error(`Unknown revelation ${id}`);
    return { lie: r.lie, truth: r.truth, verses: r.verses };
  };
  const powers = Object.fromEntries(Object.values(c.POWERS).map(p => [p.id, p]));
  const chapters = c.CHAPTERS.map((ch, index) => ({
    id: ch.id,
    index,
    title: ch.title,
    sphere: ch.sphere.name,
    meaning: ch.sphere.meaning,
    story: ch.story,
    verse: ch.verse,
    realm: ch.realm,
    palette: Object.fromEntries(Object.entries(ch.palette).map(([k, v]) => [k, hex(v)])),
    look: look(ch.palette),
    traumas: ch.traumas,
    boss: { name: ch.boss.name, lie: ch.boss.lie, hp: ch.boss.hp },
    revelation: revelation(ch.revelationId),
    report: ch.report,
    node: { x: TREE_NODES[ch.id][0], y: TREE_NODES[ch.id][1] },
    unlockedBy: UNLOCKED_BY[ch.id] ?? (index > 0 && !UNLOCKED_BY[ch.id] ? c.CHAPTERS[index - 1].id : ''),
    side: Boolean(UNLOCKED_BY[ch.id]),
  }));
  for (const ch of chapters) ch.unlockedByTitle = chapters.find(x => x.id === ch.unlockedBy)?.title ?? '';
  return {
    version: 1,
    title: { name: 'HolyHolyHoly 3D', subtitle: 'Burzenie twierdz', verse: c.STORY.titleVerse, motto: { ref: '2 Kor 10,4', text: (c.BIBLE['2 Kor 10,4'] ?? '').replace(/^\((.*)\)$/, '$1') } },
    story: { intro: INTRO, howTo: HOW_TO, fall: c.STORY.fall, finale: c.STORY.finale, disclaimer: c.STORY.disclaimer, crisisHelp: c.STORY.crisisHelp },
    chapters,
    traumas: Object.fromEntries(Object.values(c.TRAUMAS).map(t => [t.kind, {
      kind: t.kind,
      name: t.name,
      color: hex(t.color),
      colorRgb: rgb(t.color),
      shape: TRAUMA_SHAPES[t.kind],
      archetype: ARCHETYPE[t.behavior],
      hp: t.hp,
      speed: t.speed,
      truth: t.truth.word,
      verse: t.truth.verse,
    }])),
    gifts: GIFTS.map(([id, kind, maxLevel, description, levels]) => {
      const p = powers[id];
      if (!p) throw new Error(`Unknown power ${id}`);
      if (levels.length !== maxLevel) throw new Error(`${id}: ${levels.length} level texts for max level ${maxLevel}`);
      return { id, name: p.name, kind, maxLevel, description, levels, verse: p.verse };
    }),
    fruits: c.FRUITS.map(f => ({ id: f.id, name: f.name, effect: FRUIT_EFFECTS[f.id] ?? f.effect, verse: f.verse, maxLevel: f.maxLevel, costs: f.costs })),
    ranks: c.RANKS.map(r => ({ id: r.id, name: r.name, light: r.light, wings: r.wings, verse: r.verse, blessing: r.blessing })),
    tree: {
      // the paths between the spheres, as beams: centre, length and angle (degrees) on the ground
      paths: TREE_PATHS.map(([a, b]) => {
        const [x1, y1] = TREE_NODES[a];
        const [x2, y2] = TREE_NODES[b];
        return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, length: Math.round(Math.hypot(x2 - x1, y2 - y1)), angle: Math.round((Math.atan2(y2 - y1, x2 - x1) * 1800) / Math.PI) / 10 };
      }),
    },
  };
}

