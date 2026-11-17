/**
 * Rzeki żywej wody's "Postępy" card in the lobby (DESIGN.md §13.14), from the app's shared classes (styles.css):
 *
 *   the numbers   the most drops, sessions, whole ways down and up
 *   the map       which of the four maps the way walks (a radio row), and each map's card: its count and where its
 *                 stations come from ("12 centrów mapy dwunastu (obraz 2) + 5 …"), its stations as little rose
 *                 windows (in colour once lit, waiting in lead until then) with their gift, their verse and how many
 *                 times each was lit going down and thanked going up
 *   where you begin  "Kontynuuj od Serca" (where the last session stopped) or "Od początku"; a tap on a station of
 *                 an album makes it the next start ("Zacznij tutaj") — the founder's "navigate"
 *   the way       down, up, or down and then up (a radio row; saved at once)
 *   the breath    the rest's breath (round 11, the founder's word): four steppers — Wdech, Zatrzymanie (po
 *                 wdechu), Wydech, Bezdech (po wydechu) — each −/+ from 0 to 15 s, the presets as one-tap chips
 *                 (4 · 6 spokojny, 5 · 5 równy, 4 · 4 · 4 · 4 kwadrat, 4 · 7 · 8 wyciszenie), the breaths in a rest
 *                 (auto, or 1…12) and a live line ("Odpoczynek: 3 oddechy · 30 s"); a breath under 2 s is refused
 *                 with a short message
 *   own words     the player's own words of prayer (≤ 120 characters), shown at every station instead of the
 *                 prayer; kept only in this device's progress, set as text, never as markup
 *   the chorale   the quiet chorale's switch
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PHASES, BREATH_PRESETS, breathCycle, sameBreath, type BreathPhase } from '../kit/breath';
import { coarsePointer } from '../kit/mobile';
import { passage } from '../kit/scripture';
import {
  MAP, MAPS, WAYS, cleanOwn, fromText, giftName, mapName, mapPicture, stationName, stationTag, stationWhere, tierName, verseOf, type MapId, type StationId, type Way,
} from './content';
import { t, type Key } from './i18n';
import {
  autoBreaths, bestOf, breathOf, clearStart, restOf, setBreath, setMap, setOwn, setRestBreaths, setStart, setWay, startOf, stationsLit, stepBreathOf, tierOf,
  timesLit, type RzekiProgress,
} from './meta';
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

/** A finger-sized button (≥ 44 px each way: the app's .btn is 36 px tall, so the size is set on it). */
function big(b: HTMLButtonElement): HTMLButtonElement {
  b.style.minWidth = '44px';
  b.style.minHeight = '44px';
  return b;
}

export function progressPanel(p: RzekiProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  /** a refused change's message, shown once under the steppers */
  let note = '';
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    }, note, msg => {
      note = msg;
      render();
      note = '';
    })) root.appendChild(el);
  };
  render();
  return root;
}

/**
 * The rest's breath: the presets as chips, four steppers (each phase 0…15 s), the breaths in a rest (auto or
 * 1…12) and the live line of what a rest will be.  A step that would leave a breath under 2 s is refused, and says why.
 */
function breathCard(p: RzekiProgress, changed: () => void, note: string, refuse: (msg: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const b = breathOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  const presets = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.presets') });
  for (const [k, pat] of Object.entries(BREATH_PRESETS)) {
    const on = sameBreath(b, pat);
    presets.append(big(button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { 'aria-pressed': String(on) })));
  }
  out.push(presets);
  for (const ph of BREATH_PHASES) {
    const name = t(`panel.ph.${ph}` as Key);
    const step = (d: number) => () => {
      if (stepBreathOf(p, ph as BreathPhase, d)) changed();
      else refuse(t('panel.tooShort'));
    };
    const less = big(button('−', step(-1), 'btn', { 'aria-label': t('panel.less', { what: name }), disabled: b[ph] <= 0 ? '' : null }));
    const more = big(button('+', step(1), 'btn', { 'aria-label': t('panel.more', { what: name }), disabled: b[ph] >= 15 ? '' : null }));
    out.push(h('div', { class: 'row', role: 'group', 'aria-label': name },
      h('span', { class: 'grow' }, name), less, h('output', { 'aria-live': 'polite' }, t('secs', { n: b[ph] })), more));
  }
  if (note) out.push(h('p', { class: 'task-feedback bad', role: 'alert' }, note));
  // the breaths in a rest: auto (the nearest to 26 s) or the player's own count
  const auto = p.restBreaths <= 0, n = auto ? autoBreaths(p) : p.restBreaths;
  const setN = (v: number) => () => { setRestBreaths(p, Math.max(1, Math.min(RULES.restBreathsMax, v))); changed(); };
  out.push(h('div', { class: 'arcade-sub' }, t('panel.restBreaths')),
    h('div', { class: 'row', role: 'group', 'aria-label': t('panel.restBreaths') },
      big(button('−', setN(n - 1), 'btn', { 'aria-label': t('panel.less', { what: t('panel.restBreaths') }), disabled: n <= 1 ? '' : null })),
      h('output', { 'aria-live': 'polite' }, auto ? t('panel.auto', { n }) : String(n)),
      big(button('+', setN(n + 1), 'btn', { 'aria-label': t('panel.more', { what: t('panel.restBreaths') }), disabled: n >= RULES.restBreathsMax ? '' : null })),
      big(button(t('panel.autoBtn'), () => { setRestBreaths(p, 0); changed(); }, auto ? 'btn on' : 'btn', { 'aria-pressed': String(auto) }))));
  const rest = restOf(p);
  out.push(h('p', null, `${t('panel.restLine', { breaths: t('breaths', { n: rest.cycles }), sec: secText(rest.sec) })} · ${t('panel.cycle', { sec: secText(breathCycle(b)) })}`));
  return out;
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

function build(p: RzekiProgress, changed: () => void, note = '', refuse: (msg: string) => void = () => undefined): HTMLElement[] {
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
      h('div', { class: 'arcade-panel mt10' }, h('p', null, `${list.length} · ${t(`map.${m}.count` as Key)}`), album(p, m, start, changed)));
    out.push(card);
  }
  out.push(h('p', { class: 'muted' }, t('panel.placesNote')), h('p', { class: 'muted' }, t('panel.mapNote')), h('p', { class: 'muted' }, t('panel.tiersNote')));
  if (p.abideBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.abideBest)}`));

  // ── the way ──
  const wayBtn = (w: Way) => button(t(`panel.way.${w}` as 'panel.way.down'), () => { if (setWay(p, w)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.way === w) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.way')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.way') }, WAYS.map(wayBtn)),
    h('p', { class: 'muted' }, t(`panel.wayNote.${p.way}` as 'panel.wayNote.down')));

  // ── the breath ──
  out.push(...breathCard(p, changed, note, refuse));

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
