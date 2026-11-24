/**
 * Brzemiona's "Postępy" card in the lobby (DESIGN.md §18), from the app's shared classes (styles.css):
 *
 *   the way         (round 16) first: "Moje brzemiona" or "Za innych", a line each; the rest of the card is the way's
 *   — "Moje brzemiona" —
 *   the numbers     burdens given, sessions, the most in one session
 *   my list         up to 12 topics (≤ 32 characters, typed), each "start here", up, down, remove; "Następne: …";
 *                   suggestions on two shelves, closed until opened (a phone's card stays short): Codzienne — ten
 *                   themes, a tap shows its topics as "+" chips; Warownie — the 24 strongholds by their five groups, a
 *                   tap shows its burdens, its care note when it has one, "Dodaj (n)" and "Zastąp listę" (a second tap
 *                   confirms); kept only on this device, never in the summary
 *   — "Za innych" (as it was) —
 *   the numbers     burdens carried, sessions, the whole world reached, the most in one session
 *   where you begin "Zaczniesz od: Anna" or "W drodze do krzyża: Anna · krąg: …" (a burden in progress)
 *   the list        whom you pray for: up to 12 names and matters, kept only on this device — each with what they
 *                   carry (optional), up, down, remove, and "start here"; add a name, a kind of burden, "Ja" (your
 *                   own burden only when you add it yourself), the whole world; empty, the default list is shown
 *   the version     smoke and light, or light only (no smoke at all: only light flows from the Cross to them)
 *   the breath      presets, four steppers 0–15 s, the breaths of a rest (as in the series' other meditations)
 *   what was carried  the counts by kind
 *   care            the helpline in this language; prayer and attention training, not a treatment (the own way first:
 *                   "Nie musisz niczego przeżywać od nowa. Wystarczy nazwać i oddać.")
 *
 * Built with h(); every name and topic is set as text (never markup).  A choice saves the progress and redraws the
 * card; which shelf, theme or stronghold is open is the card's own state (kept across redraws, not saved).
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PHASES, BREATH_PRESETS, breathCycle, sameBreath, type BreathPhase } from '../kit/breath';
import { lang } from '../../i18n';
import { WAROWNIA_GROUPS, WAROWNIE, warowniaName, warownieIn, type WarowniaId } from '../kit/warownie';
import { CIRCLES, DEFAULT_LIST, KINDS, LIST_MAX, NAME_MAX, OWN_CIRCLES, TOPIC_MAX, type Item, type KindId, type Way } from './content';
import { burdensText, circleName, kindName, ownDefaults, t, whoName, type Key } from './i18n';
import {
  TALLIES, addItem, addPerson, addTopic, addTopics, bestOf, breathOf, hasTopic, moveItem, moveTopic, ownQueueOf, ownStartOf, queueOf, removeItem,
  removeTopic, setBreath, setKind, setOwnStart, setStart, setWay, startOf, stepBreathOf, topicsToAdd, type BrzProgress,
} from './meta';
import { secText } from './sim';
import { DAILY, themeTopics, warowniaTopics } from './topics';

/** What the card keeps open between redraws (never saved): the shelves, the theme or stronghold shown, a confirm. */
interface View {
  daily: boolean;
  warownie: boolean;
  theme: string | null;
  warownia: WarowniaId | null;
  armed: WarowniaId | null;
  focusAdd: boolean;
}

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
  const view: View = { daily: false, warownie: false, theme: null, warownia: null, armed: null, focusAdd: false };
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    }, note, msg => {
      note = msg;
      render();
      note = '';
    }, view, render)) root.appendChild(el);
    if (view.focusAdd) {
      view.focusAdd = false;
      root.querySelector<HTMLInputElement>('input[data-add]')?.focus();
    }
  };
  render();
  return root;
}

/** The way: two finger-sized choices and a line for each (the rest of the card follows the one chosen). */
function wayCard(p: BrzProgress, changed: () => void): HTMLElement[] {
  const pick = (way: Way, key: Key) => {
    const on = p.way === way;
    const b = big(button(t(key), () => { if (!on && setWay(p, way)) changed(); }, on ? 'btn on grow' : 'btn grow', { role: 'radio', 'aria-checked': String(on) }));
    b.style.maxWidth = '320px';
    return b;
  };
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.way') }, pick('own', 'panel.wayOwn'), pick('others', 'panel.wayOthers'));
  return [
    h('div', { class: 'arcade-sub' }, t('panel.way')), seg,
    h('p', { class: 'muted' }, t('panel.wayOwnNote')), h('p', { class: 'muted' }, t('panel.wayOthersNote')),
  ];
}

/** One topic of the own list: its name (a tap makes it the next), up, down, remove. */
function topicRow(p: BrzProgress, topic: string, i: number, startIdx: number, changed: () => void): HTMLElement {
  const here = i === startIdx;
  const name = big(button(`${here ? '▶ ' : ''}${topic}`, () => { if (setOwnStart(p, i, ownDefaults())) changed(); }, here ? 'btn on grow' : 'btn ghost grow', {
    'aria-pressed': String(here), 'aria-label': t('panel.startHere', { who: topic }), title: t('panel.startHere', { who: topic }),
  }));
  name.style.justifyContent = 'flex-start';
  name.style.textAlign = 'left';
  name.style.overflowWrap = 'anywhere';
  return h('div', { class: 'row', role: 'group', 'aria-label': topic },
    name,
    big(button('↑', () => { if (moveTopic(p, i, -1)) changed(); }, 'btn', { 'aria-label': t('panel.up', { who: topic }), disabled: i === 0 ? '' : null })),
    big(button('↓', () => { if (moveTopic(p, i, 1)) changed(); }, 'btn', { 'aria-label': t('panel.down', { who: topic }), disabled: i === p.own.list.length - 1 ? '' : null })),
    big(button('✕', () => { if (removeTopic(p, i)) changed(); }, 'btn', { 'aria-label': t('panel.remove', { who: topic }) })));
}

/** A topic offered by a shelf: "+ praca" (a tap adds it), or "✓ praca" when it is on the list already. */
function topicChip(p: BrzProgress, topic: string, changed: () => void): HTMLButtonElement {
  const on = hasTopic(p, topic);
  const full = p.own.list.length >= LIST_MAX;
  return big(button(`${on ? '✓' : '+'} ${topic}`, () => { if (addTopic(p, topic)) changed(); }, on ? 'btn on' : 'btn', {
    'aria-label': on ? `${topic}: ${t('panel.onList')}` : t('panel.addTopic', { topic }), disabled: on || full ? '' : null,
  }));
}

/** A shelf's toggle: its name with ▸ / ▾, aria-expanded. */
function shelfToggle(name: string, open: boolean, toggle: () => void): HTMLButtonElement {
  const b = big(button(`${open ? '▾' : '▸'} ${name}`, toggle, open ? 'btn on grow' : 'btn grow', { 'aria-expanded': String(open) }));
  b.style.justifyContent = 'flex-start';
  b.style.maxWidth = '320px';
  return b;
}

/** "Moje brzemiona": the numbers, where it goes on, the list, the suggestions. */
function ownCard(p: BrzProgress, changed: () => void, view: View, redraw: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const defaults = ownDefaults();
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.given'), fmtNum(p.given)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.listCount'), `${fmtNum(p.own.list.length)}/${LIST_MAX}`)));
  out.push(h('p', { class: 'muted' }, t('panel.ownRules')));

  // ── my list ──
  const st = ownStartOf(p, defaults), q = ownQueueOf(p, defaults);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.ownList')), h('p', { class: 'muted' }, t('panel.ownListNote')));
  const first = q[st.index];
  if (first) {
    out.push(h('p', null, st.resumed
      ? t('panel.ownResume', { topic: first.name, circle: circleName(OWN_CIRCLES[Math.min(1, st.circle)]) })
      : t('panel.next', { topic: first.name })));
  }
  if (p.own.list.length) p.own.list.forEach((topic, i) => out.push(topicRow(p, topic, i, st.index, changed)));
  else out.push(h('p', { class: 'muted' }, t('panel.ownEmpty', { list: defaults.join(', ') })));
  if (p.own.list.length >= LIST_MAX) out.push(h('p', { class: 'muted' }, t('panel.listFull')));
  else {
    const input = h('input', { type: 'text', maxlength: String(TOPIC_MAX), placeholder: t('panel.topicPh'), 'aria-label': t('panel.topicPh'), autocomplete: 'off', 'data-add': '' }) as HTMLInputElement;
    input.style.minHeight = '44px';
    const add = () => {
      if (addTopic(p, input.value)) {
        view.focusAdd = true;
        changed();
      } else input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    out.push(h('div', { class: 'row' }, h('label', { class: 'f grow' }, input), big(button(t('panel.addName'), add, 'btn primary'))));
  }

  // ── the suggestions: two shelves, closed until opened ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.suggest')));
  out.push(h('div', { class: 'row' },
    shelfToggle(t('panel.daily'), view.daily, () => { view.daily = !view.daily; redraw(); }),
    shelfToggle(t('panel.warownie'), view.warownie, () => { view.warownie = !view.warownie; redraw(); })));
  if (view.daily) {
    out.push(h('p', { class: 'muted' }, t('panel.dailyNote')));
    const themes = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.daily') });
    for (const th of DAILY) {
      const on = view.theme === th.id;
      themes.append(big(button(th.name[lang], () => { view.theme = on ? null : th.id; redraw(); }, on ? 'btn on' : 'btn', { 'aria-expanded': String(on) })));
    }
    out.push(themes);
    const th = DAILY.find(x => x.id === view.theme);
    if (th) {
      const topics = themeTopics(th);
      const chips = h('div', { class: 'seg', role: 'group', 'aria-label': th.name[lang] }, ...topics.map(x => topicChip(p, x, changed)));
      const n = topicsToAdd(p, topics);
      if (n > 1) chips.append(big(button(t('panel.addAll', { n }), () => { if (addTopics(p, topics, 'add')) changed(); }, 'btn primary')));
      out.push(chips);
    }
  }
  if (view.warownie) {
    out.push(h('p', { class: 'muted' }, t('panel.warownieNote')));
    for (const g of WAROWNIA_GROUPS) {
      out.push(h('p', null, h('b', null, g.name[lang])));
      const row = h('div', { class: 'seg', role: 'group', 'aria-label': g.name[lang] });
      for (const w of warownieIn(g.id)) {
        const on = view.warownia === w.id;
        row.append(big(button(warowniaName(w, lang), () => { view.warownia = on ? null : w.id; view.armed = null; redraw(); }, on ? 'btn on' : 'btn', { 'aria-expanded': String(on) })));
      }
      out.push(row);
      const w = WAROWNIE.find(x => x.id === view.warownia && x.group === g.id);
      if (w) out.push(...warowniaDetail(p, w.id, w.care, changed, view, redraw));
    }
  }
  return out;
}

/** A stronghold opened on its shelf: its care note(s), its burdens as chips, "Dodaj (n)" and "Zastąp listę". */
function warowniaDetail(p: BrzProgress, id: WarowniaId, care: readonly string[], changed: () => void, view: View, redraw: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const topics = warowniaTopics(id);
  out.push(h('p', null, h('b', null, t('panel.warowniaSet', { name: warowniaName(WAROWNIE.find(w => w.id === id)!, lang), n: burdensText(topics.length) }))));
  for (const c of care) out.push(h('p', { role: 'note' }, `♡ ${t(`care.${c}` as Key)}`));
  const chips = h('div', { class: 'seg', role: 'group', 'aria-label': warowniaName(WAROWNIE.find(w => w.id === id)!, lang) }, ...topics.map(x => topicChip(p, x, changed)));
  out.push(chips);
  const n = topicsToAdd(p, topics);
  const acts = h('div', { class: 'row' });
  if (n > 0) acts.append(big(button(t('panel.addAll', { n }), () => { if (addTopics(p, topics, 'add')) changed(); }, 'btn primary')));
  if (p.own.list.length) {
    const armed = view.armed === id;
    acts.append(big(button(t(armed ? 'panel.replaceSure' : 'panel.replace', { n: topics.length }), () => {
      if (!armed) {
        view.armed = id;
        redraw();
        return;
      }
      view.armed = null;
      if (addTopics(p, topics, 'replace')) changed();
    }, armed ? 'btn on' : 'btn')));
  }
  if (acts.childNodes.length) out.push(acts);
  return out;
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

function build(
  p: BrzProgress, changed: () => void, note = '', refuse: (msg: string) => void = () => undefined,
  view: View = { daily: false, warownie: false, theme: null, warownia: null, armed: null, focusAdd: false }, redraw: () => void = changed,
): HTMLElement[] {
  const out: HTMLElement[] = [...wayCard(p, changed)];
  if (p.way === 'own') {
    out.push(...ownCard(p, changed, view, redraw));
    out.push(...common(p, changed, note, refuse));
    if (p.calmBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.calmBest)}`));
    out.push(h('div', { class: 'arcade-sub' }, t('panel.care')), h('p', null, t('panel.ownCare')), h('p', { class: 'muted' }, t('panel.careNote')));
    return out;
  }
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

  out.push(...common(p, changed, note, refuse));

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

/** What both ways share: the version (smoke and light, or light only) and the breath. */
function common(p: BrzProgress, changed: () => void, note: string, refuse: (msg: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  out.push(h('div', { class: 'arcade-sub' }, t('panel.variant')));
  const ver = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.variant') },
    big(button(t('panel.smoke'), () => { p.lightOnly = false; changed(); }, !p.lightOnly ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(!p.lightOnly) })),
    big(button(t('panel.lightOnly'), () => { p.lightOnly = true; changed(); }, p.lightOnly ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.lightOnly) })));
  const own = p.way === 'own';
  out.push(ver, h('p', { class: 'muted' }, t(own ? 'panel.ownLightNote' : 'panel.lightNote')));
  out.push(...breathCard(p, changed, note, refuse));
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
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t(p.way === 'own' ? 'panel.ownBreathNote' : 'panel.breathNote')));
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
  // one breath's length; how many breaths a rest lasts, and after how many circles it comes, is the lobby's Rytm row
  // (kit/rhythm.ts, round 15) — one place for the rest's rhythm in every game
  out.push(h('p', null, t('panel.cycle', { sec: secText(breathCycle(b)) })), h('p', { class: 'muted' }, t('panel.restRhythm')));
  return out;
}
