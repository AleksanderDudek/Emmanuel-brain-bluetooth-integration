/**
 * The lobby's "Postępy" for Motylarnia, from the app's existing .arcade-* classes: the numbers, the
 * Atlas (one tile per species: its butterfly and caterpillar cards, the classic recipe, the forms
 * earned — or a silhouette), the next habitat, what pyłek is saving up for, the day's leaf, tomorrow's
 * eggs and the published egg odds.
 */
import { h } from '../../ui/dom';
import { dayKey, daySeed } from '../kit/progress';
import { ABERRATION_NAME, HABITATS, PIGMENTS, PLANTS, TIERS, capital, speciesById, type Aberration, type Species } from './content';
import {
  ABERRATION_FLAG, atlasStats, dailySpecies, eggsLine, laterEggs, openHabitats, pollenTarget, type AtlasEntry, type ButterflyRec, type MothProgress,
} from './meta';
import { atlasOrder, drawTile } from './preview';

/** Soft hyphens at syllable breaks of the long words, so a name never spills out of a narrow tile. */
const BREAKS: Record<string, string> = {
  rzeżuchowiec: 'rzeżu\u00ADchowiec', szachownica: 'szachow\u00ADnica', sześcioplamek: 'sześcio\u00ADplamek', pokrzywnik: 'pokrzyw\u00ADnik',
  przestrojnik: 'przestroj\u00ADnik', czerwończyk: 'czerwoń\u00ADczyk', strzępotek: 'strzępo\u00ADtek', siarecznik: 'siarecz\u00ADnik',
  szlaczkoń: 'szlacz\u00ADkoń', kapustnik: 'kapust\u00ADnik',
};
const breakable = (name: string) => name.split(' ').map(w => BREAKS[w] ?? w).join(' ');

/** what the marks under a tile mean (one line under the Atlas) */
const FORMS_KEY = '◆ forma klasyczna: zjedz trzy barwy z kropek · ✦ promienny · ◐ odmiana';

const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));

function meter(label: string, value: string, share: number): HTMLElement {
  const inner = h('i');
  inner.style.width = `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`;
  return h('div', { class: 'arcade-meter' }, h('span', null, label, h('b', null, value)), h('i', null, inner));
}

/** The species' biggest stored butterfly (the records keep it for good; null only for a species never seen). */
function bestRecord(p: MothProgress, sp: Species): ButterflyRec | null {
  let best: ButterflyRec | null = null;
  for (const r of p.butterflies) if (r.sp === sp.id && (!best || r.mm > best.mm)) best = r;
  return best;
}

const ABERRATIONS = Object.keys(ABERRATION_FLAG) as Aberration[];
const aberrationsOf = (e: AtlasEntry): Aberration[] => ABERRATIONS.filter(a => e.ab & ABERRATION_FLAG[a]);

/** The three forms a species can take, as marks dimmed until earned: ◆ classic, ✦ radiant (×n), ◐ aberration. */
function forms(e: AtlasEntry): HTMLElement {
  const ab = aberrationsOf(e).length;
  const mark = (glyph: string, n: number) => {
    const s = h('span', null, n > 1 ? `${glyph}${n}` : glyph);
    if (!n) s.style.opacity = '0.3';
    return s;
  };
  return h('small', { 'aria-label': `forma klasyczna: ${e.classic ? 'tak' : 'nie'}, promienne: ${e.radiant}, odmiany: ${ab}` },
    mark('◆', e.classic ? 1 : 0), ' ', mark('✦', e.radiant), ' ', mark('◐', ab));
}

/** The tile's full story for its tooltip: tier, recipe, forms. */
function describe(sp: Species, e: AtlasEntry | undefined): string {
  const tier = TIERS[sp.tier].name;
  if (!e || (!e.larva && e.n === 0)) return tier;
  const parts = [capital(sp.name), tier, `przepis formy klasycznej: ${sp.classic.map(k => PIGMENTS[k].name).join(', ')}`];
  if (e.n === 0) return [...parts, 'na razie gąsienica'].join(' · ');
  parts.push(e.classic ? 'forma klasyczna ✓' : 'forma klasyczna jeszcze przed Tobą');
  if (e.radiant) parts.push(`promienne: ${e.radiant}`);
  const ab = aberrationsOf(e);
  if (ab.length) parts.push(`odmiany: ${ab.map(a => ABERRATION_NAME[a]).join(', ')}`);
  return parts.join(' · ');
}

function tile(p: MothProgress, sp: Species): HTMLElement {
  const e = p.atlas[sp.id], seen = !!e && e.n > 0, larva = !!e?.larva;
  const pic = h('canvas', { 'aria-hidden': 'true' });
  drawTile(pic, sp, e, seen ? bestRecord(p, sp) : null);
  const tier = TIERS[sp.tier];
  const cls = [seen ? 'on' : '', tier.cls].filter(Boolean).join(' ');
  const detail = seen ? `${e.best} mm${e.n > 1 ? ` · ×${e.n}` : ''}` : larva ? 'gąsienica' : tier.name.toLowerCase();
  return h('div', { class: cls, title: describe(sp, e) }, pic, seen || larva ? breakable(sp.name) : '?', h('small', null, detail), seen ? forms(e) : null);
}

export function progressPanel(p: MothProgress): HTMLElement {
  const day = dayKey();
  const st = atlasStats(p);
  const open = openHabitats(p);
  const parts: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat('Gatunki', String(st.found), '/18'),
      stat('Motyle', String(st.total)),
      stat('Największy', st.biggest ? String(st.biggest) : '—', st.biggest ? 'mm' : ''),
      stat('Promienne', String(st.radiant))),
  ];
  const locked: HTMLElement[] = [];
  for (const hab of HABITATS) {
    const species = atlasOrder(hab.id);
    const found = species.filter(s => (p.atlas[s.id]?.n ?? 0) > 0).length;
    if (open.includes(hab.id)) {
      parts.push(h('p', { class: 'arcade-sub' }, `Atlas · ${hab.name} ${found}/9`));
      parts.push(h('div', { class: 'arcade-album' }, species.map(s => tile(p, s))));
    } else {
      locked.push(meter(`${hab.name} otworzy się po ${hab.unlock} motylach`, `${Math.min(p.total, hab.unlock)}/${hab.unlock}`, p.total / hab.unlock));
    }
  }
  if (st.found) parts.push(h('p', { class: 'muted' }, FORMS_KEY));
  parts.push(...locked);
  const target = pollenTarget(p);
  if (target) {
    const price = TIERS[target.tier].price, ready = p.pollen >= price;
    parts.push(meter(ready ? `Za pyłek: jajo ${target.name} w następnym liściu` : `Pyłek na jajo: ${target.name}`, ready ? 'gotowe' : `${p.pollen}/${price}`, p.pollen / price));
  }
  const dsp = p.daily.day === day && p.daily.sp ? speciesById(p.daily.sp) : dailySpecies(daySeed('motylarnia', day));
  const done = p.daily.day === day && p.daily.done;
  // played today without it: it waits on the next session's egg cards (the very first leaf ever is the tutorial)
  const when = p.lastDay !== day ? 'ten sam liść dla wszystkich.'
    : p.sessions <= 1 ? 'od następnej sesji (pierwszy liść był na rozgrzewkę).' : 'czeka w następnej sesji.';
  parts.push(h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, 'Liść dnia'),
      h('p', null, done ? `${capital(dsp.name)}, ${p.daily.mm} mm — gotowe na dziś.` : `${capital(dsp.name)} ${PLANTS[dsp.plant].on} — ${when}`)),
    h('span', { class: done ? 'badge ok' : 'badge' }, done ? '1/1' : '0/1')));
  const later = laterEggs(p, day);
  const ready = p.eggs.filter(e => e.ready <= day);
  if (later.length) parts.push(h('p', null, h('b', null, 'Jutro wyklują się: '), eggsLine(later)));
  else if (ready.length) parts.push(h('p', null, h('b', null, 'Czekają jaja: '), eggsLine(ready.map(e => ({ sp: speciesById(e.sp), n: 1, isNew: !(p.atlas[e.sp]?.n) })))));
  parts.push(h('p', { class: 'muted' },
    'Szanse jaj: pospolite 62 %, rzadkie 26 %, wyjątkowe 10 %, legendarne 2 %. Najpóźniej: rzadkie w 5. jaju, wyjątkowe w 15., legendarne w 28.; odmiana w 40. motylu.'));
  return h('div', { class: 'arcade-panel' }, parts);
}
