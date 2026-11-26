/**
 * A small health library for the engine's tests and the dev play harness (round 20, DESIGN §24): four meditations of
 * two or three scenes in two worlds of different depth (a body on the ground, tissue under the lens), words in all
 * four languages, two looks, no tune (the warm pad).  Its pictures are simple shapes: it tests the engine, not art.
 */
import type { HealthLibrary, WorldPainter, WorldState } from '../../src/arcade/kit/healthlib/spec';
import { GOLD, PEARL, glow } from '../../src/arcade/kit/healthlib/paint';
import type { Catalog, Lang } from '../../src/i18n';

const N = ' ';

const body: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx, variant, look) {
    ctx.fillStyle = look === 'dark' ? '#6a3a3a' : '#c58f80';
    ctx.beginPath();
    ctx.ellipse(50, 60, 24, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    if (variant === 'bare') return;
    ctx.beginPath();
    ctx.arc(50, 14, 12, 0, Math.PI * 2);
    ctx.fill();
  },
  draw(ctx, st: WorldState) {
    if (typeof ctx.beginPath !== 'function') return;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2 / st.px;
    ctx.beginPath();
    ctx.arc(50, 60, 4 + 20 * st.g, 0, Math.PI * 2 * Math.max(0.01, st.g));
    ctx.stroke();
    glow(ctx, PEARL, 50, 60, 10 + 10 * st.light, 0.2 + 0.4 * st.deep);
  },
  focusAt: (_s, g) => [50, 60 - 20 * g],
};

const cell: WorldPainter = {
  depth: 1,
  lens: true,
  bake(ctx) {
    ctx.fillStyle = '#3a2050';
    ctx.fillRect(0, 0, 100, 100);
  },
  draw(ctx, st: WorldState) {
    if (typeof ctx.beginPath !== 'function') return;
    ctx.fillStyle = GOLD;
    for (let i = 0; i < Math.round(12 * st.g); i++) {
      ctx.beginPath();
      ctx.arc(15 + (i % 4) * 23, 20 + Math.floor(i / 4) * 25, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  counter: (_s, g) => (g > 0.2 ? `≈ ${Math.round(g * 12)} · 1 mm²` : null),
};

const view = { x: 0, y: 0, w: 100, h: 100 };

const MEDS = [
  { id: 'jeden', scenes: ['a1', 'a2'], verse: 'psa139.13-14' },
  { id: 'dwa', scenes: ['b1', 'b2', 'b3'], verse: 'psa103.5' },
  { id: 'trzy', scenes: ['c1', 'c2'], verse: 'psa4.8' },
  { id: 'cale', scenes: ['d1', 'd2', 'd3'], verse: 'isa40.31' },
] as const;

const SCENES = Object.fromEntries(MEDS.flatMap(m => m.scenes).map((s, i) => [s, {
  world: i % 2 ? 'cell' : 'body',
  view,
  focus: [50, 50] as const,
  labels: [
    { part: 'core', at: [50, 60] as const, side: 1 as const, from: 0.1 },
    { part: 'edge', at: [20, 30] as const, side: -1 as const, dy: 0.5, from: 0.5 },
  ],
  variant: s === 'd3' ? 'bare' : undefined,
}]));

type Words = Record<string, string | { one: string; few?: string; many?: string; other: string }>;

function words(l: Lang): Words {
  const W: Record<Lang, { unit: Words['unit']; med: string; line: string; care: string; scene: string; teach: string; tip: string; at: string; part: [string, string]; look: [string, string]; open: [string, string, string, string]; thanks: string; how: [string, string, string]; not: string; say: string }> = {
    pl: {
      unit: { one: `{n}${N}iskra`, few: `{n}${N}iskry`, many: `{n}${N}iskier`, other: `{n}${N}iskry` },
      med: 'Medytacja', line: 'Krótka droga przez obraz.', care: 'Śpij 7–9 godzin każdej nocy.', scene: 'Scena',
      teach: 'Komórki pracują spokojnie, dzień i noc.', tip: 'Wyobrażaj sobie, jak obraz rośnie.', at: 'Patrz na środek obrazu.',
      part: ['rdzeń', 'brzeg'], look: ['jasny', 'ciemny'], open: ['Próba', 'Krótkie medytacje o ciele.', 'Czym to jest', 'To wizualizacja i trening uwagi, nie leczenie.'],
      thanks: 'Dziękuję za każdą iskrę.', how: ['Wybierz medytację i przejdź przez jej obrazy.', 'Patrz na rosnącą część.', 'To nie jest leczenie.'], not: 'To wizualizacja, nie leczenie.', say: 'Spokojnie, obraz jest tutaj.',
    },
    en: {
      unit: { one: `{n}${N}spark`, other: `{n}${N}sparks` },
      med: 'Meditation', line: 'A short walk through a picture.', care: 'Sleep 7–9 hours every night.', scene: 'Scene',
      teach: 'Cells work calmly, day and night.', tip: 'Picture the image growing.', at: 'Look at the middle of the picture.',
      part: ['core', 'edge'], look: ['light', 'dark'], open: ['Trial', 'Short meditations about the body.', 'What this is', 'This is visualisation and attention training, not a treatment.'],
      thanks: 'Thank you for every spark.', how: ['Choose a meditation and walk through its pictures.', 'Look at the growing part.', 'This is not a treatment.'], not: 'This is visualisation, not a treatment.', say: 'Calmly, the picture is here.',
    },
    de: {
      unit: { one: `{n}${N}Funke`, other: `{n}${N}Funken` },
      med: 'Meditation', line: 'Ein kurzer Weg durch ein Bild.', care: 'Schlaf jede Nacht 7–9 Stunden.', scene: 'Szene',
      teach: 'Zellen arbeiten ruhig, Tag und Nacht.', tip: 'Stell dir vor, wie das Bild wächst.', at: 'Schau in die Mitte des Bildes.',
      part: ['Kern', 'Rand'], look: ['hell', 'dunkel'], open: ['Probe', 'Kurze Meditationen über den Körper.', 'Was das ist', 'Das ist Visualisierung und Aufmerksamkeitstraining, keine Behandlung.'],
      thanks: 'Danke für jeden Funken.', how: ['Wähle eine Meditation und geh durch ihre Bilder.', 'Schau auf den wachsenden Teil.', 'Das ist keine Behandlung.'], not: 'Das ist Visualisierung, keine Behandlung.', say: 'Ruhig, das Bild ist hier.',
    },
    sv: {
      unit: { one: `{n}${N}gnista`, other: `{n}${N}gnistor` },
      med: 'Meditation', line: 'En kort väg genom en bild.', care: 'Sov 7–9 timmar varje natt.', scene: 'Scen',
      teach: 'Celler arbetar lugnt, dag och natt.', tip: 'Föreställ dig hur bilden växer.', at: 'Titta på bildens mitt.',
      part: ['kärna', 'kant'], look: ['ljus', 'mörk'], open: ['Prov', 'Korta meditationer om kroppen.', 'Vad detta är', 'Det här är visualisering och uppmärksamhetsträning, inte behandling.'],
      thanks: 'Tack för varje gnista.', how: ['Välj en meditation och gå genom dess bilder.', 'Titta på den del som växer.', 'Det här är inte behandling.'], not: 'Det här är visualisering, inte behandling.', say: 'Lugnt, bilden är här.',
    },
  };
  const w = W[l];
  const out: Words = {
    unit: w.unit,
    'story.open.title': w.open[0], 'story.open.text': w.open[1], 'story.open2.title': w.open[2], 'story.open2.text': w.open[3],
    'story.whole.text': w.thanks, 'howto.goal': w.how[0], 'howto.tip1': w.how[1], 'howto.tip2': w.how[2], 'panel.not': w.not,
    'part.core': w.part[0], 'part.edge': w.part[1], 'look.light': w.look[0], 'look.dark': w.look[1],
  };
  MEDS.forEach((m, i) => {
    out[`med.${m.id}`] = `${w.med} ${i + 1}`;
    out[`med.${m.id}.line`] = w.line;
    out[`med.${m.id}.care`] = w.care;
    for (const s of m.scenes) {
      out[`scene.${s}`] = `${w.scene} ${s.toUpperCase()}`;
      out[`teach.${s}`] = w.teach;
      out[`tip.${s}`] = w.tip;
      out[`say.at.${s}.1`] = w.at;
    }
  });
  for (const m of ['open', 'grown', 'whole', 'end']) for (let i = 1; i <= 3; i++) out[`say.${m}.${i}`] = `${w.say} (${m} ${i})`;
  return out;
}

export const FIXTURE: HealthLibrary = {
  id: 'fixture',
  meds: MEDS,
  scenes: SCENES,
  worlds: { body, cell },
  portal: (shallow, deep) => (shallow && deep ? [50, 60] : null),
  root: 'psa139.13-14',
  closers: ['lam3.22-23', '2co4.16'],
  looks: ['light', 'dark'],
  perScene: 100,
  words: { pl: words('pl') as Catalog<string>, en: words('en') as Catalog<string>, de: words('de') as Catalog<string>, sv: words('sv') as Catalog<string> },
  tune: () => null,
  tint: { ground: '#160b26', light: '#ffb7a0' },
};
