/**
 * Rzeki żywej wody's "Postępy" card in the lobby (DESIGN.md §13.14), from the app's shared classes (styles.css):
 *
 *   the numbers   the most drops, sessions, whole ways down and up
 *   the map       which of the four maps the way walks (a radio row), and each map's card: its stations as little
 *                 rose windows (in colour once lit, waiting in lead until then) with their gift, their verse and how
 *                 many times each was lit going down and thanked going up, its count, and which picture it is from
 *   where you begin  "Kontynuuj od Serca" (where the last session stopped) or "Od początku"; a tap on a station of
 *                 an album makes it the next start ("Zacznij tutaj") — the founder's "navigate"
 *   the way       down, up, or down and then up (a radio row; saved at once)
 *   own words     the player's own words of prayer (≤ 120 characters), shown at every station instead of the
 *                 prayer; kept only in this device's progress, set as text, never as markup
 *   the chorale   the quiet chorale's switch
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { coarsePointer } from '../kit/mobile';
import { passage } from '../kit/scripture';
import {
  MAP, MAPS, WAYS, cleanOwn, fromText, giftName, mapName, mapPicture, stationName, stationTag, stationWhere, tierName, verseOf, type MapId, type StationId, type Way,
} from './content';
import { t } from './i18n';
import { bestOf, clearStart, setMap, setOwn, setStart, setWay, startOf, stationsLit, tierOf, timesLit, type RzekiProgress } from './meta';
import { bakeRose } from './paint';
import { RULES } from './rules';
import { secText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A little tile of a station: its rose window in colour (at its craft tier) once lit, its lead and a ghost of glass until then. */
function tile(station: StationId, lit: boolean, tier: number): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#100b2c';
  ctx.fillRect(0, 0, 52, 40);
  const rose = bakeRose(station, 14.5, dpr, tier);
  if (rose) {
    const s = rose.half;
    ctx.drawImage(lit ? rose.glass : rose.lead, 26 - s, 20 - s, 2 * s, 2 * s);
  }
  return c;
}

export function progressPanel(p: RzekiProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

/** A map's album: its stations as tiles, each a button that makes it the next start. */
function album(p: RzekiProgress, map: MapId, start: StationId | null, changed: () => void): HTMLElement {
  return h('div', { class: 'arcade-album' }, MAP[map].stations.map(s => {
    const n = timesLit(p, s), tier = tierOf(p, s);
    const marks = n > 0 ? t('panel.lit', { down: p.down[s] ?? 0, up: p.up[s] ?? 0 }) : t('panel.never');
    const here = start === s;
    const tag = stationTag(s);
    const pick = () => {
      if (map !== p.map) setMap(p, map);
      if (setStart(p, s)) changed();
    };
    const el = h('div', {
      class: tier >= 3 ? 'on legend' : tier >= 2 ? 'on epic' : tier >= 1 ? 'on rare' : n > 0 || here ? 'on' : null,
      role: 'button', tabindex: '0', 'aria-pressed': String(here),
      'aria-label': t('panel.startHere', { name: stationName(s) }),
      title: `${stationName(s)}${tag ? ` · ${tag}` : ''} — ${stationWhere(s)} · ${giftName(s)} · ${passage(verseOf(s, 'down')).ref}`,
      on: {
        click: (e: Event) => { e.preventDefault(); pick(); },
        keydown: (e: Event) => {
          const k = (e as KeyboardEvent).key;
          if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(); }
        },
      },
    }, tile(s, n > 0, tier), stationName(s), h('small', null, here ? t('panel.here') : tier > 0 ? `${marks} · ${tierName(tier)}` : marks));
    return el;
  }));
}

function build(p: RzekiProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.descents'), fmtNum(p.descents)),
    stat(t('panel.ascents'), fmtNum(p.ascents))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── the map ──
  const mapBtn = (m: MapId) => button(mapName(m), () => { if (setMap(p, m)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.map === m) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.map')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.map') }, MAPS.map(mapBtn)));

  // ── where you begin ──
  const st = startOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.start')));
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.start') });
  if (st.resumed) seg.append(button(t('panel.continue', { from: fromText(st.station) }), () => undefined, 'btn', { role: 'radio', 'aria-checked': 'true' }));
  seg.append(button(t('panel.fromTop'), () => { clearStart(p); changed(); }, 'btn', { role: 'radio', 'aria-checked': String(!st.resumed) }));
  out.push(seg, h('p', { class: 'muted' }, t(coarsePointer() ? 'panel.startHint' : 'panel.startHint.click')));

  // ── each map's card: the chosen one open ──
  for (const m of MAPS) {
    const list = MAP[m].stations;
    const lit = stationsLit(p, list);
    const head = `${mapName(m)} · ${t('panel.mapCount', { lit, n: list.length })} · ${mapPicture(m)}`;
    const start = m === p.map ? (st.resumed ? st.station : null) : null;
    const card = h('details', m === p.map ? { open: '' } : null,
      h('summary', { class: m === p.map ? null : 'muted' }, `${m === p.map ? '● ' : ''}${head} ▾`),
      h('div', { class: 'arcade-panel mt10' }, album(p, m, start, changed)));
    out.push(card);
  }
  out.push(h('p', { class: 'muted' }, t('panel.placesNote')), h('p', { class: 'muted' }, t('panel.mapNote')), h('p', { class: 'muted' }, t('panel.tiersNote')));
  if (p.abideBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.abideBest)}`));

  // ── the way ──
  const wayBtn = (w: Way) => button(t(`panel.way.${w}` as 'panel.way.down'), () => { if (setWay(p, w)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.way === w) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.way')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.way') }, WAYS.map(wayBtn)),
    h('p', { class: 'muted' }, t(`panel.wayNote.${p.way}` as 'panel.wayNote.down')));

  // ── own words ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.own')), h('p', { class: 'muted' }, t('panel.ownNote')));
  const input = h('input', { type: 'text', maxlength: String(RULES.ownMax), placeholder: t('panel.ownPlaceholder'), 'aria-label': t('panel.own'), autocomplete: 'off' }) as HTMLInputElement;
  input.value = p.own;
  // the field's caption counts the characters as they are typed (plain text: what is kept is cleaned)
  const count = h('span', null, t('panel.ownCount', { n: [...input.value].length }));
  input.addEventListener('input', () => { count.textContent = t('panel.ownCount', { n: [...cleanOwn(input.value)].length }); });
  const keep = () => {
    setOwn(p, input.value);
    changed();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
  out.push(h('label', { class: 'f' }, count, input));
  const row = h('div', { class: 'row' }, button(t('panel.ownSave'), keep, 'btn primary'));
  if (p.own) row.append(button(t('panel.ownClear'), () => { setOwn(p, ''); changed(); }, 'btn ghost'));
  out.push(row, h('p', null, p.own ? t('panel.ownNow') : t('panel.ownBase')));

  // ── the chorale ──
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
  box.checked = p.song;
  box.addEventListener('change', () => {
    p.song = box.checked;
    changed();
  });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.song')), h('label', { class: 'switch' }, box, h('span', null, t('panel.song'))),
    h('p', { class: 'muted' }, t('panel.songNote')));
  return out;
}
