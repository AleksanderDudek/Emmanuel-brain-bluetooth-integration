/**
 * Każda myśl's "Postępy" card in the lobby (DESIGN §19, §20), from the app's shared classes (styles.css):
 *
 *   the numbers      thoughts given in all, sessions, the most in one session, truths received
 *   what today       one clear first choice — "Co dziś?": (a) "To, co mnie trapi" (the emotion and the areas of life,
 *                    an own set first if chosen); (b) "Warownia" — the 24 of the series by their five groups (tabs,
 *                    chips that say "zburzona 2×" or "3/6"; the chooser opens only when asked); (c) "Moje warownie" —
 *                    up to 6 own sets of up to 10 pairs, with an editor that a 360-px phone manages (one pair a block:
 *                    the lie, its truth under it, its feeling); a care note where a warownia's care asks for one
 *   how heavy        "Jak ciężko jest teraz?" 0–10 before the next session (the finale asks again), and the last few
 *                    before → after — self-report, said so
 *   set aside        the library thoughts marked "not mine", with "bring back"
 *   the breath       the rest's rhythm: the kit's presets as one-tap chips (4 · 6 by default)
 *   care             attention and imagination training, not therapy; the help line in this language
 *
 * Built with h(); every own word is set as text (never markup).  A choice saves the progress and redraws the card;
 * typing in the editor saves on change and never redraws under the player's fingers.
 */
import { fmtNum, lang } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, sameBreath } from '../kit/breath';
import { WAROWNIA_GROUPS, warownia as warOf, warownieIn, type WarowniaGroup, type WarowniaId } from '../kit/warownie';
import { AREAS, CHOICES, EMOS, OWN_EMOS, needsCare, type OwnEmo } from './content';
import { breathWords, emoName, setNameOf, t, warName, type Key } from './i18n';
import {
  addPair, addSet, allAreas, bestOf, breathOf, chooseSet, chooseWar, editPair, forgetSets, lastWeights, placeOf, removePair, removeSet, renameSet,
  restoreSkipped, setBefore, setBreath, setEmotion, setFirst, setMode, toggleArea, type Mode, type MysliProgress,
} from './meta';
import { PAIR_CHARS, PAIRS_MAX, SETS_MAX, SET_NAME_CHARS, WAR_SIZE, type Place } from './sets';
import { secText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A chip: a name and, under it, a small status ("zburzona 2×", "3/6"). */
function chip(name: string, status: string, on: boolean, onClick: () => void, extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: on ? 'btn on' : 'btn', type: 'button', ...extra },
    h('span', null, name), status ? h('small', null, status) : null) as HTMLButtonElement;
  b.style.minHeight = '44px';
  b.style.flexDirection = 'column';
  b.style.gap = '0';
  b.style.lineHeight = '1.2';
  b.style.padding = '6px 12px';
  b.style.maxWidth = '100%';
  b.style.whiteSpace = 'normal';
  b.style.textAlign = 'center';
  const small = b.querySelector('small');
  if (small) {
    small.style.fontSize = '12px';
    small.style.opacity = '0.8';
  }
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A set's place in a few words: "zburzona 2× · 3/6", "3/6", or nothing yet. */
export function placeText(pl: Place | undefined, n: number): string {
  if (!pl) return '';
  const parts: string[] = [];
  if (pl.falls > 0) parts.push(t('war.falls', { n: pl.falls }));
  if (pl.burned.length > 0) parts.push(`${pl.burned.length}/${n}`);
  return parts.join(' · ');
}

/** The card's own state between redraws (not progress): the chooser open, its group, the own set being edited. */
interface Ui { chooser: boolean; group: WarowniaGroup; editing: number }

export function progressPanel(p: MysliProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  let note = '';
  const ui: Ui = { chooser: false, group: (p.war && warOf(p.war)?.group) || 'unrest', editing: -1 };
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    const cx: Ctx = {
      p, ui, note,
      changed: () => { save(); render(); },
      saved: () => save(),
      told: msg => { note = msg; save(); render(); note = ''; },
    };
    for (const el of build(cx)) root.appendChild(el);
  };
  render();
  return root;
}

interface Ctx { p: MysliProgress; ui: Ui; note: string; changed: () => void; saved: () => void; told: (msg: string) => void }

/** An emotion select for an own lie. */
function emoSelect(value: OwnEmo, label: string, onChange: (e: OwnEmo) => void): HTMLSelectElement {
  const sel = h('select', { 'aria-label': label },
    ...OWN_EMOS.map(e => h('option', { value: e, selected: value === e ? '' : null }, t(`ownEmo.${e}` as Key)))) as HTMLSelectElement;
  sel.style.minHeight = '44px';
  sel.style.width = 'auto';
  sel.style.maxWidth = '100%';
  sel.style.alignSelf = 'flex-start';
  sel.addEventListener('change', () => onChange(sel.value as OwnEmo));
  return sel;
}

function textInput(value: string, max: number, label: string, ph: string): HTMLInputElement {
  const input = h('input', { type: 'text', maxlength: String(max), placeholder: ph, 'aria-label': label, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  input.value = value;
  input.style.minHeight = '44px';
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  return input;
}

function build(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.burned'), fmtNum(p.burned)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('stat.truths'), fmtNum(p.truths))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── what today ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.what')));
  const modes: Mode[] = ['today', 'war', 'own'];
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.what') },
    modes.map(m => {
      const on = p.mode === m;
      return button(t(`mode.${m}` as Key), () => {
        // a mode that needs a set shows the choice; until one is chosen, play is today's
        setMode(p, m);
        if (m === 'war' && !p.war) cx.ui.chooser = true;
        cx.changed();
      }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on), 'data-mysli-mode': m });
    })));
  if (p.mode === 'today') out.push(...today(cx));
  else if (p.mode === 'war') out.push(...war(cx));
  else out.push(...own(cx));
  if (cx.note) out.push(h('p', { class: 'muted', role: 'status' }, cx.note));

  // ── how heavy is it now ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.before')));
  const row = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.before') });
  for (let i = 0; i <= 10; i++) {
    const on = p.before === i;
    row.append(button(String(i), () => { setBefore(p, on ? null : i); cx.changed(); }, on ? 'btn on' : 'btn', {
      role: 'radio', 'aria-checked': String(on), 'aria-label': t('panel.weightOf', { n: i }),
    }));
  }
  out.push(row, h('p', { class: 'muted' }, p.before !== null ? `${t('panel.beforeSet', { n: p.before })} · ${t('panel.beforeNote')}` : t('panel.beforeNote')));
  const hist = lastWeights(p);
  if (hist.length) out.push(h('p', null, `${t('panel.history')}: ${hist.map(w => (w.before === null ? `${w.after}/10` : `${w.before} → ${w.after}`)).join(' · ')}`));

  // ── the breath ──
  const b = breathOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
      Object.entries(BREATH_PRESETS).map(([k, pat]) => button(t(`preset.${k}` as Key), () => { setBreath(p, pat); cx.changed(); }, sameBreath(b, pat) ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(sameBreath(b, pat)) }))),
    h('p', { class: 'muted' }, `${t('panel.breathNote')} (${breathWords(b)})`));

  // ── what was given ──
  const by = EMOS.filter(e => p.byEmo[e] > 0);
  if (by.length) out.push(h('p', null, `${t('panel.byEmo')}: ${by.map(e => `${emoName(e)} · ${fmtNum(p.byEmo[e])}`).join('  ·  ')}`));
  if (p.calmBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.calmBest)}`));
  if (p.quietBest > 0) out.push(h('p', null, `${t('panel.quietBest')}: ${secText(p.quietBest)}`));
  out.push(h('p', { class: 'muted' }, t('panel.lengths')));

  // ── care ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.care')), h('p', { class: 'muted' }, t('panel.careNote')));
  return out;
}

// ── (a) what troubles me ─────────────────────────────────────────

function today(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const out: HTMLElement[] = [h('p', { class: 'muted' }, t('mode.todayNote'))];
  out.push(h('div', { class: 'arcade-sub' }, t('panel.emotion')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.emotion') },
      CHOICES.map(c => button(t(`choice.${c}` as Key), () => { if (setEmotion(p, c)) cx.changed(); }, p.emotion === c ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.emotion === c) }))),
    h('p', { class: 'muted' }, t('panel.emotionNote')));
  out.push(h('div', { class: 'arcade-sub' }, t('panel.areas')),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.areas') },
      button(t('panel.allAreas'), () => { allAreas(p); cx.changed(); }, p.areas.length === 0 ? 'btn on' : 'btn', { 'aria-pressed': String(p.areas.length === 0) }),
      ...AREAS.map(a => {
        const on = p.areas.includes(a);
        return button(t(`area.${a}` as Key), () => { if (toggleArea(p, a)) cx.changed(); }, on ? 'btn on' : 'btn', { 'aria-pressed': String(on) });
      })),
    h('p', { class: 'muted' }, t('panel.areasNote')));
  // an own set first (round 15's own thoughts became one: "Moje myśli")
  const usable = p.sets.map((s, i) => ({ s, i })).filter(x => x.s.pairs.length > 0);
  if (usable.length) {
    const sel = h('select', { 'aria-label': t('panel.first') },
      h('option', { value: '-1', selected: p.first < 0 ? '' : null }, t('panel.firstNone')),
      ...usable.map(x => h('option', { value: String(x.i), selected: p.first === x.i ? '' : null }, setNameOf(p.sets, x.i)))) as HTMLSelectElement;
    sel.style.minHeight = '44px';
    sel.style.maxWidth = '100%';
    sel.addEventListener('change', () => { setFirst(p, Number(sel.value)); cx.changed(); });
    const lab = h('label', { class: 'row' }, h('span', null, t('panel.first')), sel);
    out.push(lab);
  }
  if (p.skipped.length) {
    out.push(h('div', { class: 'row' }, h('span', { class: 'grow' }, t('panel.skipped', { n: p.skipped.length })),
      button(t('panel.restore'), () => { restoreSkipped(p); cx.changed(); }, 'btn')));
  }
  return out;
}

// ── (b) a warownia of the series ─────────────────────────────────

const CARE_KEYS = { ocd: 'care.ocd', crisis: 'care.crisis', medical: 'care.medical', addiction: 'care.addiction' } as const;

function war(cx: Ctx): HTMLElement[] {
  const { p, ui } = cx;
  const out: HTMLElement[] = [h('p', { class: 'muted' }, t('mode.warNote'))];
  const w = p.war ? warOf(p.war) : undefined;
  if (w && !ui.chooser) {
    const pl = p.places[w.id];
    const group = WAROWNIA_GROUPS.find(g => g.id === w.group);
    const box = h('div', { class: 'arcade-daily', 'data-mysli': 'war-chosen' });
    box.style.flexDirection = 'column';
    box.style.alignItems = 'stretch';
    box.style.gap = '6px';
    const ocd = w.care.includes('ocd');
    box.append(
      h('div', { class: 'arcade-sub' }, group ? group.name[lang] : ''),
      h('b', null, warName(w)),
      h('p', null, t(`w.${w.id}.line` as Key)),
    );
    const status = pl && (pl.burned.length || pl.falls) ? [
      pl.burned.length ? t('war.stones', { k: pl.burned.length, n: WAR_SIZE }) : '',
      pl.falls ? t('war.falls', { n: pl.falls }) : '',
    ].filter(Boolean).join(' · ') : '';
    if (status) box.append(h('p', null, status));
    box.append(h('p', null, t(ocd ? 'war.dailyOcd' : 'war.daily')));
    if (pl && pl.falls > 0 && !ocd) box.append(h('p', null, t('war.again')));
    for (const c of w.care) box.append(h('p', { class: c === 'crisis' ? 'task-feedback bad' : 'muted', role: 'note' }, t(CARE_KEYS[c])));
    box.append(h('div', { class: 'row' }, button(t('war.change'), () => { ui.chooser = true; ui.group = w.group; cx.changed(); }, 'btn', { 'data-mysli': 'war-change' })));
    out.push(box);
    return out;
  }
  // the chooser: the five groups as tabs, the strongholds of the open one as chips
  out.push(h('div', { class: 'arcade-sub' }, t('war.choose')));
  out.push(h('div', { class: 'seg', role: 'tablist', 'aria-label': t('war.choose') },
    // the groups as quiet tabs (outlined), the strongholds under them as full chips
    WAROWNIA_GROUPS.map(g => button(g.name[lang], () => { ui.group = g.id; cx.changed(); }, ui.group === g.id ? 'btn ghost on' : 'btn ghost', {
      role: 'tab', 'aria-selected': String(ui.group === g.id), 'data-mysli-group': g.id,
    }))));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': WAROWNIA_GROUPS.find(g => g.id === ui.group)?.name[lang] ?? '' },
    warownieIn(ui.group).map(x => chip(warName(x), placeText(p.places[x.id], WAR_SIZE), p.war === x.id, () => pickWar(cx, x.id), {
      role: 'radio', 'aria-checked': String(p.war === x.id), 'data-mysli-war': x.id,
    }))));
  return out;
}

function pickWar(cx: Ctx, id: WarowniaId): void {
  chooseWar(cx.p, id);
  placeOf(cx.p, id);
  cx.ui.chooser = false;
  cx.changed();
}

// ── (c) my own warownie ──────────────────────────────────────────

function own(cx: Ctx): HTMLElement[] {
  const { p, ui } = cx;
  const out: HTMLElement[] = [h('p', { class: 'muted' }, t('mode.ownNote'))];
  if (!p.sets.length) out.push(h('p', null, t('own.empty')));
  const chips = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('mode.own') },
    p.sets.map((s, i) => chip(setNameOf(p.sets, i), placeText(s.place, s.pairs.length), p.set === i, () => {
      chooseSet(p, i);
      ui.editing = ui.editing === i ? i : -1;
      cx.changed();
    }, { role: 'radio', 'aria-checked': String(p.set === i), 'data-mysli-set': String(i) })));
  if (p.sets.length < SETS_MAX) {
    chips.append(button(t('own.new'), () => {
      const i = addSet(p);
      if (i >= 0) {
        chooseSet(p, i);
        ui.editing = i;
      }
      cx.changed();
    }, 'btn primary', { 'data-mysli': 'own-new' }));
  }
  out.push(chips);
  if (p.sets.length >= SETS_MAX) out.push(h('p', { class: 'muted' }, t('own.setsFull')));
  const i = p.set;
  const s = p.sets[i];
  if (s) out.push(ui.editing === i ? editor(cx, i) : chosenOwn(cx, i));
  if (p.sets.some(x => x.name && needsCare(x.name) || x.pairs.some(pr => needsCare(pr.lie) || needsCare(pr.truth)))) {
    out.push(h('p', { class: 'task-feedback bad', role: 'note' }, t('panel.careOwn')));
  }
  if (p.sets.length) out.push(h('div', { class: 'row' }, button(t('own.forgetAll'), () => { forgetSets(p); ui.editing = -1; cx.told(t('own.forgotten')); }, 'btn ghost')));
  return out;
}

/** The own set chosen: its name, its place, its pairs' lies (as text), "Edytuj". */
function chosenOwn(cx: Ctx, i: number): HTMLElement {
  const { p, ui } = cx;
  const s = p.sets[i];
  const box = h('div', { class: 'arcade-daily', 'data-mysli': 'own-chosen' });
  box.style.flexDirection = 'column';
  box.style.alignItems = 'stretch';
  box.style.gap = '6px';
  box.append(h('b', null, setNameOf(p.sets, i)));
  const status = [s.place.burned.length ? t('war.stones', { k: s.place.burned.length, n: s.pairs.length }) : '', s.place.falls ? t('war.falls', { n: s.place.falls }) : '']
    .filter(Boolean).join(' · ');
  if (status) box.append(h('p', null, status));
  if (!s.pairs.length) box.append(h('p', null, t('own.noPairs')));
  for (const pr of s.pairs.slice(0, PAIRS_MAX)) {
    const line = h('p', null, `${pr.lie} → ${pr.truth || '…'}`);
    line.style.overflowWrap = 'anywhere';
    box.append(line);
  }
  if (p.first === i) box.append(h('p', { class: 'muted' }, t('own.first')));
  box.append(h('div', { class: 'row' }, button(t('own.edit'), () => { ui.editing = i; cx.changed(); }, 'btn', { 'data-mysli': 'own-edit' })));
  return box;
}

/**
 * The editor of an own set, phone first: its name; each pair a block — the lie, its truth under it, its feeling, ✕;
 * then a new pair's block with "Dodaj parę"; "Zapomnij tę warownię"; "Gotowe".  Typing saves on change (never redraws
 * under the fingers); adding or removing redraws.
 */
function editor(cx: Ctx, i: number): HTMLElement {
  const { p, ui } = cx;
  const s = p.sets[i];
  const box = h('div', { class: 'arcade-daily', 'data-mysli': 'own-editor' });
  box.style.flexDirection = 'column';
  box.style.alignItems = 'stretch';
  box.style.gap = '10px';
  const care = h('p', { class: 'task-feedback bad', role: 'note' }, t('panel.careOwn'));
  const checkCare = (extra = '') => {
    const heavy = needsCare(extra) || needsCare(s.name) || s.pairs.some(pr => needsCare(pr.lie) || needsCare(pr.truth));
    care.hidden = !heavy;
  };
  // the name
  const name = textInput(s.name, SET_NAME_CHARS, t('own.name'), t('own.namePh'));
  name.addEventListener('change', () => { renameSet(p, i, name.value); cx.saved(); });
  name.addEventListener('input', () => checkCare(name.value));
  box.append(h('label', { class: 'f' }, h('span', { class: 'arcade-sub' }, t('own.name')), name));
  // the pairs
  s.pairs.forEach((pr, k) => {
    const blk = h('div', { role: 'group', 'aria-label': t('own.pair', { n: k + 1 }) });
    blk.style.display = 'flex';
    blk.style.flexDirection = 'column';
    blk.style.gap = '6px';
    blk.style.paddingTop = '8px';
    blk.style.borderTop = '1px solid var(--line)';
    const lie = textInput(pr.lie, PAIR_CHARS, `${t('own.pair', { n: k + 1 })}: ${t('own.lie')}`, t('own.liePh'));
    const truth = textInput(pr.truth, PAIR_CHARS, `${t('own.pair', { n: k + 1 })}: ${t('own.truth')}`, t('own.truthPh'));
    lie.addEventListener('change', () => {
      if (editPair(p, i, k, { lie: lie.value })) cx.saved();
      else lie.value = pr.lie;
    });
    truth.addEventListener('change', () => { if (editPair(p, i, k, { truth: truth.value })) cx.saved(); });
    lie.addEventListener('input', () => checkCare(lie.value));
    truth.addEventListener('input', () => checkCare(truth.value));
    // a phone at 360 px: the pair's number and ✕ on a row, the lie, its truth under it, its feeling
    blk.append(
      h('div', { class: 'row' }, h('span', { class: 'grow arcade-sub' }, t('own.pair', { n: k + 1 })),
        button('✕', () => { if (removePair(p, i, k)) cx.changed(); }, 'btn', { 'aria-label': t('own.remove', { text: pr.lie }) })),
      lie, truth,
      emoSelect(pr.emo, `${t('own.pair', { n: k + 1 })}: ${t('panel.ownEmo')}`, e => { if (editPair(p, i, k, { emo: e })) cx.saved(); }));
    box.append(blk);
  });
  // a new pair
  if (s.pairs.length < PAIRS_MAX) {
    const blk = h('div', { role: 'group', 'aria-label': t('own.add') });
    blk.style.display = 'flex';
    blk.style.flexDirection = 'column';
    blk.style.gap = '6px';
    blk.style.paddingTop = '8px';
    blk.style.borderTop = '1px solid var(--line)';
    const lie = textInput('', PAIR_CHARS, t('own.lie'), t('own.liePh'));
    const truth = textInput('', PAIR_CHARS, t('own.truth'), t('own.truthPh'));
    lie.setAttribute('data-mysli', 'new-lie');
    truth.setAttribute('data-mysli', 'new-truth');
    let emo: OwnEmo = 'mixed';
    const add = () => {
      if (addPair(p, i, lie.value, truth.value, emo)) cx.changed();
      else lie.focus();
    };
    for (const inp of [lie, truth]) {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      inp.addEventListener('input', () => checkCare(inp.value));
    }
    blk.append(lie, truth, h('div', { class: 'row' }, emoSelect(emo, t('panel.ownEmo'), e => { emo = e; }), button(t('own.add'), add, 'btn primary', { 'data-mysli': 'own-add' })));
    box.append(blk);
  } else box.append(h('p', { class: 'muted' }, t('own.full')));
  box.append(h('p', { class: 'muted' }, t('own.note')));
  checkCare();
  box.append(care);
  box.append(h('div', { class: 'row' },
    button(t('own.done'), () => { ui.editing = -1; cx.changed(); }, 'btn primary', { 'data-mysli': 'own-done' }),
    button(t('own.forget'), () => { removeSet(p, i); ui.editing = -1; cx.told(t('own.forgotten')); }, 'btn ghost')));
  return box;
}

