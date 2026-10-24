/**
 * The lobby's "Postępy" for Motylarnia, from the app's existing .arcade-* classes: the numbers, the
 * Atlas (one tile per species: its butterfly and caterpillar cards, the classic recipe, the forms
 * earned — or a silhouette), the next habitat, what pyłek is saving up for, the day's leaf, tomorrow's
 * eggs and the published egg odds.
 */
import { h } from '../../ui/dom';
import { dayKey, daySeed } from '../kit/progress';
import {
  ABERRATION_NAME, ABERRATION_PITY, HABITATS, PIGMENTS, PLANTS, SPECIES, TIERS, capital, speciesById, type Aberration, type Species,
} from './content';
import { t } from './i18n';
import {
  ABERRATION_FLAG, atlasStats, dailySpecies, eggsLine, laterEggs, openHabitats, pollenTarget, type AtlasEntry, type ButterflyRec, type MothProgress,
} from './meta';
import { atlasOrder, drawTile } from './preview';

/**
 * Soft hyphens at the syllable or compound breaks of the long words in all four languages' names, so
 * a name never spills out of a narrow tile (German "Schwarzkolbiger Braun-Dickkopffalter" takes five
 * short lines).  A word not listed simply stays whole.
 */
const BREAKS: Record<string, string> = {
  // pl
  rzeżuchowiec: 'rzeżu\u00ADchowiec', szachownica: 'szachow\u00ADnica', sześcioplamek: 'sześcio\u00ADplamek', pokrzywnik: 'pokrzyw\u00ADnik',
  przestrojnik: 'przestroj\u00ADnik', czerwończyk: 'czerwoń\u00ADczyk', strzępotek: 'strzępo\u00ADtek', siarecznik: 'siarecz\u00ADnik',
  szlaczkoń: 'szlacz\u00ADkoń', kapustnik: 'kapust\u00ADnik',
  // en
  Tortoiseshell: 'Tortoise\u00ADshell', Hummingbird: 'Humming\u00ADbird', Swallowtail: 'Swallow\u00ADtail', Fritillary: 'Fritil\u00ADlary',
  Brimstone: 'Brim\u00ADstone',
  // de
  Kohlweißling: 'Kohl\u00ADweiß\u00ADling', Aurorafalter: 'Aurora\u00ADfalter', Tagpfauenauge: 'Tag\u00ADpfauen\u00ADauge',
  Zitronenfalter: 'Zitronen\u00ADfalter', 'Hauhechel-Bläuling': 'Hau\u00ADhechel-Bläu\u00ADling', Schwalbenschwanz: 'Schwalben\u00ADschwanz',
  Taubenschwänzchen: 'Tauben\u00ADschwänz\u00ADchen', Schachbrett: 'Schach\u00ADbrett', Ochsenauge: 'Ochsen\u00ADauge',
  Wiesenvögelchen: 'Wiesen\u00ADvögel\u00ADchen', Feuerfalter: 'Feuer\u00ADfalter', 'Weißklee-Gelbling': 'Weiß\u00ADklee-Gelb\u00ADling',
  Perlmutterfalter: 'Perl\u00ADmutter\u00ADfalter', Schwarzkolbiger: 'Schwarz\u00ADkolbiger', 'Braun-Dickkopffalter': 'Braun-Dick\u00ADkopf\u00ADfalter',
  'Argus-Bläuling': 'Argus-Bläu\u00ADling', 'Sechsfleck-Widderchen': 'Sechs\u00ADfleck-Widder\u00ADchen',
  // sv
  kålfjäril: 'kål\u00ADfjäril', aurorafjäril: 'aurora\u00ADfjäril', påfågelöga: 'påfågel\u00ADöga', nässelfjäril: 'nässel\u00ADfjäril',
  citronfjäril: 'citron\u00ADfjäril', puktörneblåvinge: 'puk\u00ADtörne\u00ADblå\u00ADvinge', makaonfjäril: 'makaon\u00ADfjäril',
  dagsvärmare: 'dags\u00ADvärmare', schackbrädesfjäril: 'schack\u00ADbrädes\u00ADfjäril', slåttergräsfjäril: 'slåtter\u00ADgräs\u00ADfjäril',
  kamgräsfjäril: 'kam\u00ADgräs\u00ADfjäril', guldvinge: 'guld\u00ADvinge', höfjäril: 'hö\u00ADfjäril',
  ängspärlemorfjäril: 'ängs\u00ADpärlemor\u00ADfjäril', svartspolsmygare: 'svart\u00ADspol\u00ADsmygare', ljungblåvinge: 'ljung\u00ADblå\u00ADvinge',
  sexfläckig: 'sex\u00ADfläckig', bastardsvärmare: 'bastard\u00ADsvärmare',
  // a tile's small line under the name: the tier of an undiscovered species, "caterpillar"
  legendarny: 'legen\u00ADdarny', exceptional: 'excep\u00ADtional', caterpillar: 'cater\u00ADpillar',
  außergewöhnlich: 'außer\u00ADgewöhn\u00ADlich', exceptionell: 'excep\u00ADtionell', legendarisk: 'legenda\u00ADrisk',
};
const breakable = (text: string) => text.split(' ').map(w => BREAKS[w] ?? w).join(' ');

const pct = (share: number) => Math.round(share * 100);

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
  return h('small', { 'aria-label': t(e.classic ? 'tile.formsYes' : 'tile.formsNo', { radiant: e.radiant, ab }) },
    mark('◆', e.classic ? 1 : 0), ' ', mark('✦', e.radiant), ' ', mark('◐', ab));
}

/** The tile's full story for its tooltip: tier, recipe, forms. */
function describe(sp: Species, e: AtlasEntry | undefined): string {
  const tier = TIERS[sp.tier].name;
  if (!e || (!e.larva && e.n === 0)) return tier;
  const parts = [capital(sp.name), tier, t('tile.recipe', { list: sp.classic.map(k => PIGMENTS[k].name).join(', ') })];
  if (e.n === 0) return [...parts, t('tile.larvaOnly')].join(' · ');
  parts.push(t(e.classic ? 'tile.classicDone' : 'tile.classicTodo'));
  if (e.radiant) parts.push(t('tile.radiant', { n: e.radiant }));
  const ab = aberrationsOf(e);
  if (ab.length) parts.push(t('tile.aberrations', { list: ab.map(a => ABERRATION_NAME[a]).join(', ') }));
  return parts.join(' · ');
}

function tile(p: MothProgress, sp: Species): HTMLElement {
  const e = p.atlas[sp.id], seen = !!e && e.n > 0, larva = !!e?.larva;
  const pic = h('canvas', { 'aria-hidden': 'true' });
  drawTile(pic, sp, e, seen ? bestRecord(p, sp) : null);
  const tier = TIERS[sp.tier];
  const cls = [seen ? 'on' : '', tier.cls].filter(Boolean).join(' ');
  const detail = seen ? `${e.best} mm${e.n > 1 ? ` · ×${e.n}` : ''}` : larva ? t('tile.larva') : tier.name.toLowerCase();
  return h('div', { class: cls, title: describe(sp, e) }, pic, seen || larva ? breakable(sp.name) : '?', h('small', null, breakable(detail)), seen ? forms(e) : null);
}

export function progressPanel(p: MothProgress): HTMLElement {
  const day = dayKey();
  const st = atlasStats(p);
  const open = openHabitats(p);
  const parts: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.species'), String(st.found), `/${SPECIES.length}`),
      stat(t('panel.butterflies'), String(st.total)),
      stat(t('panel.biggest'), st.biggest ? String(st.biggest) : '—', st.biggest ? 'mm' : ''),
      stat(t('panel.radiant'), String(st.radiant))),
  ];
  const locked: HTMLElement[] = [];
  for (const hab of HABITATS) {
    const species = atlasOrder(hab.id);
    const found = species.filter(s => (p.atlas[s.id]?.n ?? 0) > 0).length;
    if (open.includes(hab.id)) {
      parts.push(h('p', { class: 'arcade-sub' }, t('panel.atlas', { habitat: hab.name, found, all: species.length })));
      parts.push(h('div', { class: 'arcade-album' }, species.map(s => tile(p, s))));
    } else {
      locked.push(meter(t('panel.locked', { habitat: hab.name, n: hab.unlock }), `${Math.min(p.total, hab.unlock)}/${hab.unlock}`, p.total / hab.unlock));
    }
  }
  if (st.found) parts.push(h('p', { class: 'muted' }, t('panel.forms')));
  parts.push(...locked);
  const target = pollenTarget(p);
  if (target) {
    const price = TIERS[target.tier].price, ready = p.pollen >= price;
    parts.push(meter(t(ready ? 'panel.pollenReady' : 'panel.pollenSaving', { name: target.name }), ready ? t('panel.ready') : `${p.pollen}/${price}`, p.pollen / price));
  }
  const dsp = p.daily.day === day && p.daily.sp ? speciesById(p.daily.sp) : dailySpecies(daySeed('motylarnia', day));
  const done = p.daily.day === day && p.daily.done;
  // played today without it: it waits on the next session's egg cards (the very first leaf ever is the tutorial)
  const when = p.lastDay !== day ? 'panel.dailyOpen' : p.sessions <= 1 ? 'panel.dailyFirst' : 'panel.dailyNext';
  const name = capital(dsp.name);
  parts.push(h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('panel.daily')),
      h('p', null, done ? t('panel.dailyDone', { name, mm: p.daily.mm }) : t(when, { name, on: PLANTS[dsp.plant].on }))),
    h('span', { class: done ? 'badge ok' : 'badge' }, done ? '1/1' : '0/1')));
  const later = laterEggs(p, day);
  const ready = p.eggs.filter(e => e.ready <= day);
  if (later.length) parts.push(h('p', null, h('b', null, t('panel.tomorrow')), ' ', eggsLine(later)));
  else if (ready.length) parts.push(h('p', null, h('b', null, t('panel.waiting')), ' ', eggsLine(ready.map(e => ({ sp: speciesById(e.sp), n: 1, isNew: !(p.atlas[e.sp]?.n) })))));
  parts.push(h('p', { class: 'muted' }, t('panel.odds', {
    c: pct(TIERS[0].odds), r: pct(TIERS[1].odds), e: pct(TIERS[2].odds), l: pct(TIERS[3].odds),
    pr: TIERS[1].pity, pe: TIERS[2].pity, pl: TIERS[3].pity, pa: ABERRATION_PITY,
  })));
  return h('div', { class: 'arcade-panel' }, parts);
}
