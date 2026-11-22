/**
 * Brzemiona's "Postępy" card in the lobby (DESIGN.md §18), from the app's shared classes (styles.css):
 *
 *   the numbers     burdens carried, sessions, the whole world reached, the most in one session
 *   where you begin "Zaczniesz od: Anna" or "W drodze do krzyża: Anna · krąg: …" (a burden in progress)
 *   the list        whom you pray for: up to 12 names and matters, kept only on this device — each with what they
 *                   carry (optional), up, down, remove, and "start here"; add a name, a kind of burden, "Ja" (your
 *                   own burden only when you add it yourself), the whole world; empty, the default list is shown
 *   the version     smoke and light, or light only (no smoke at all: only light flows from the Cross to them)
 *   the breath      presets, four steppers 0–15 s, the breaths of a rest (as in the series' other meditations)
 *   what was carried  the counts by kind
 *   care            the helpline in this language; prayer and attention training, not a treatment
 *
 * Built with h(); every name is set as text (never markup).  A choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PHASES, BREATH_PRESETS, breathCycle, sameBreath, type BreathPhase } from '../kit/breath';
import { CIRCLES, DEFAULT_LIST, KINDS, LIST_MAX, NAME_MAX, type Item, type KindId } from './content';
import { circleName, kindName, t, whoName, type Key } from './i18n';
import {
  TALLIES, addItem, addPerson, autoBreaths, bestOf, breathOf, moveItem, queueOf, removeItem, restOf, setBreath, setKind, setRestBreaths, setStart, startOf,
  stepBreathOf, type BrzProgress,
} from './meta';
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

/** A finger-sized button (the app's .btn is 36 px tall). */
function big(b: HTMLButtonElement): HTMLButtonElement {
  b.style.minWidth = '44px';
  b.style.minHeight = '44px';
  return b;
}

export function progressPanel(p: BrzProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
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

/** One entry of the list: its name (a tap makes it the next start), what it carries, up, down, remove. */
function entry(p: BrzProgress, it: Item, i: number, startIdx: number, changed: () => void): HTMLElement {
  const who = whoName(it);
  const here = i === startIdx;
  const name = big(button(`${here ? '▶ ' : ''}${who}`, () => { if (setStart(p, i)) changed(); }, here ? 'btn on grow' : 'btn ghost grow', {
    'aria-pressed': String(here), 'aria-label': t('panel.startHere', { who }), title: t('panel.startHere', { who }),
  }));
  name.style.justifyContent = 'flex-start';
  name.style.textAlign = 'left';
  name.style.overflowWrap = 'anywhere';
  const row = h('div', { class: 'row', role: 'group', 'aria-label': who }, name);
  if (it.who === 'person' || it.who === 'me') {
    const sel = h('select', { 'aria-label': `${who}: ${t('panel.carries')}` },
      h('option', { value: '' }, `${t('panel.carries')}: ${t('panel.carriesNone')}`),
      ...KINDS.map(k => h('option', { value: k, selected: it.kind === k ? '' : null }, `${t('panel.carries')}: ${kindName(k)}`))) as HTMLSelectElement;
    sel.style.minHeight = '44px';
    sel.addEventListener('change', () => {
      setKind(p, i, (sel.value || null) as KindId | null);
      changed();
    });
    row.append(sel);
  }
  row.append(
    big(button('↑', () => { if (moveItem(p, i, -1)) changed(); }, 'btn', { 'aria-label': t('panel.up', { who }), disabled: i === 0 ? '' : null })),
    big(button('↓', () => { if (moveItem(p, i, 1)) changed(); }, 'btn', { 'aria-label': t('panel.down', { who }), disabled: i === p.list.length - 1 ? '' : null })),
    big(button('✕', () => { if (removeItem(p, i)) changed(); }, 'btn', { 'aria-label': t('panel.remove', { who }) })),
  );
  return row;
}

function build(p: BrzProgress, changed: () => void, note = '', refuse: (msg: string) => void = () => undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.carried'), fmtNum(p.carried)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.world'), fmtNum(p.worlds)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── where you begin ──
  const st = startOf(p), q = queueOf(p);
  const first = q[st.index];
  if (first) {
    out.push(h('p', null, st.resumed
      ? t('panel.resume', { who: whoName(first), circle: circleName(CIRCLES[Math.min(2, st.circle)]) })
      : t('panel.start', { who: whoName(first) })));
  }

  // ── the list ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.list')), h('p', { class: 'muted' }, t('panel.listNote')));
  if (p.list.length) p.list.forEach((it, i) => out.push(entry(p, it, i, st.index, changed)));
  else {
    out.push(h('p', null, `${t('panel.default')}:`));
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.default') });
    DEFAULT_LIST.forEach((it, i) => seg.append(big(button(whoName(it), () => { if (setStart(p, i)) changed(); }, i === st.index ? 'btn on' : 'btn', {
      'aria-pressed': String(i === st.index), 'aria-label': t('panel.startHere', { who: whoName(it) }),
    }))));
    out.push(seg, h('p', { class: 'muted' }, t('panel.empty')));
  }
  if (p.list.length >= LIST_MAX) out.push(h('p', { class: 'muted' }, t('panel.listFull')));
  else {
    const input = h('input', { type: 'text', maxlength: String(NAME_MAX), placeholder: t('panel.namePh'), 'aria-label': t('panel.namePh'), autocomplete: 'off' }) as HTMLInputElement;
    input.style.minHeight = '44px';
    const add = () => {
      if (addPerson(p, input.value)) changed();
      else input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const grow = h('label', { class: 'f grow' }, input);
    out.push(h('div', { class: 'row' }, grow, big(button(t('panel.addName'), add, 'btn primary'))));
    out.push(h('div', { class: 'arcade-sub' }, t('panel.addKinds')));
    const chips = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.addKinds') });
    const has = (it: Item) => p.list.some(x => x.who === it.who && x.kind === it.kind);
    for (const k of KINDS) {
      const it: Item = { who: 'kind', name: '', kind: k };
      if (!has(it)) chips.append(big(button(`+ ${whoName(it)}`, () => { if (addItem(p, it)) changed(); })));
    }
    const world: Item = { who: 'world', name: '', kind: null };
    if (!p.list.some(x => x.who === 'world')) chips.append(big(button(`+ ${whoName(world)}`, () => { if (addItem(p, world)) changed(); })));
    if (!p.list.some(x => x.who === 'me')) chips.append(big(button(`+ ${t('panel.addMe')}`, () => { if (addItem(p, { who: 'me', name: '', kind: null })) changed(); })));
    out.push(chips, h('p', { class: 'muted' }, t('panel.meNote')));
  }

  // ── the version ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.variant')));
  const ver = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.variant') },
    big(button(t('panel.smoke'), () => { p.lightOnly = false; changed(); }, !p.lightOnly ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(!p.lightOnly) })),
    big(button(t('panel.lightOnly'), () => { p.lightOnly = true; changed(); }, p.lightOnly ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.lightOnly) })));
  out.push(ver, h('p', { class: 'muted' }, t('panel.lightNote')));

  // ── the breath ──
  out.push(...breathCard(p, changed, note, refuse));

  // ── what was carried ──
  const counts = TALLIES.filter(k => (p.tally[k] ?? 0) > 0);
  if (counts.length) {
    out.push(h('div', { class: 'arcade-sub' }, t('panel.tally')));
    out.push(h('p', null, counts.map(k => `${tallyName(k)} · ${fmtNum(p.tally[k])}`).join('  ·  ')));
  }
  if (p.calmBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.calmBest)}`));

  // ── care ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.care')), h('p', { class: 'muted' }, t('panel.careNote')));
  return out;
}

const tallyName = (k: (typeof TALLIES)[number]): string => {
  if (k === 'person') return t('who.person');
  if (k === 'me') return t('who.me');
  if (k === 'world') return t('who.world');
  return t(`who.${k}` as Key);
};

/** The breath: the presets as chips, four steppers (0…15 s), the breaths of a rest (auto or 1…12), the live line. */
function breathCard(p: BrzProgress, changed: () => void, note: string, refuse: (msg: string) => void): HTMLElement[] {
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
  const auto = p.restBreaths <= 0, n = auto ? autoBreaths(p, 600) : p.restBreaths;
  const setN = (v: number) => () => { setRestBreaths(p, Math.max(1, Math.min(RULES.restBreathsMax, v))); changed(); };
  out.push(h('div', { class: 'arcade-sub' }, t('panel.restBreaths')),
    h('div', { class: 'row', role: 'group', 'aria-label': t('panel.restBreaths') },
      big(button('−', setN(n - 1), 'btn', { 'aria-label': t('panel.less', { what: t('panel.restBreaths') }), disabled: n <= 1 ? '' : null })),
      h('output', { 'aria-live': 'polite' }, auto ? t('panel.auto', { n }) : String(n)),
      big(button('+', setN(n + 1), 'btn', { 'aria-label': t('panel.more', { what: t('panel.restBreaths') }), disabled: n >= RULES.restBreathsMax ? '' : null })),
      big(button(t('panel.autoBtn'), () => { setRestBreaths(p, 0); changed(); }, auto ? 'btn on' : 'btn', { 'aria-pressed': String(auto) }))));
  const rest = restOf(p, 600);
  out.push(h('p', null, `${t('panel.restLine', { breaths: t('breaths', { n: rest.cycles }), sec: secText(rest.sec) })} · ${t('panel.cycle', { sec: secText(breathCycle(b)) })}`));
  return out;
}
