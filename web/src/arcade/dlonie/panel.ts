/**
 * Światło w dłoniach's "Postępy" card in the lobby (DESIGN.md §18), from the app's shared classes (styles.css):
 *
 *   the numbers  the record, sessions, prayers offered, flames
 *   what it is   how a prayer goes, in one paragraph, and plainly what it is not (not a treatment, not a power sent)
 *   the names    up to 12 people the player prays for, each lifted up to God or with a hand laid where it hurts (a place);
 *                saved only on this device; add, remove, choose the place
 *   oneself      where the hand rests in a prayer for oneself
 *   the breath   5 · 5 (even) or 4 · 6 (calm), gentle, not deep
 *   the tallies  all prayers, one line per kind; the next prayer; a prayer begun and waiting
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { PLACES, type HurtPlace } from './content';
import { placeLabel, t, whoName } from './i18n';
import { BREATHS, addName, bestOf, removeName, setPlace, walkOf, type DlonieProgress } from './meta';
import { RULES } from './rules';

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

/** A place chooser: "lift up to God" (null, for a name) or a hand on one of the six places. */
function placeSelect(value: HurtPlace | null, allowLift: boolean, label: string, onPick: (v: HurtPlace | null) => void): HTMLSelectElement {
  const sel = h('select', { 'aria-label': label }) as HTMLSelectElement;
  if (allowLift) sel.append(h('option', { value: '' }, t('panel.lift')));
  for (const p of PLACES) sel.append(h('option', { value: p }, t('panel.layAt', { place: placeLabel(p) })));
  sel.value = value ?? '';
  sel.addEventListener('change', () => onPick(sel.value ? (sel.value as HurtPlace) : null));
  return sel;
}

export function progressPanel(p: DlonieProgress, save: () => void): HTMLElement {
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

/** All prayers ever, one line per kind. */
function tallyAll(p: DlonieProgress): string {
  const parts: string[] = [];
  if (p.offered.others) parts.push(t('tally.others', { n: p.offered.others }));
  if (p.offered.self) parts.push(t('tally.self', { n: p.offered.self }));
  if (p.offered.world) parts.push(t('tally.world', { n: p.offered.world }));
  return parts.length ? parts.join(' · ') : t('tally.none');
}

function build(p: DlonieProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.prayers'), fmtNum(p.prayers)),
    stat(t('panel.flames'), fmtNum(p.flamesAll))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), h('p', null, t('panel.not')));

  // ── the names ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.names')), h('p', { class: 'muted' }, t('panel.namesNote')));
  if (!p.names.length) out.push(h('p', null, t('panel.namesNone')));
  p.names.forEach((n, i) => {
    const sel = placeSelect(n.place, true, t('panel.prayFor', { name: n.name }), v => { if (setPlace(p, i, v)) changed(); });
    const label = h('b', null, n.name);
    // styles through the CSSOM (the build's CSP has no 'unsafe-inline')
    label.style.flex = '1';
    label.style.minWidth = '6em';
    label.style.overflowWrap = 'anywhere';
    out.push(h('div', { class: 'row' }, label, sel,
      button('✕', () => { if (removeName(p, i)) changed(); }, 'btn ghost', { 'aria-label': t('panel.remove', { name: n.name }), title: t('panel.remove', { name: n.name }) })));
  });
  if (p.names.length < RULES.namesMax) {
    const input = h('input', { type: 'text', maxlength: String(RULES.nameLen), placeholder: t('panel.addPh'), 'aria-label': t('panel.addPh'), autocomplete: 'off' }) as HTMLInputElement;
    const add = () => {
      if (addName(p, input.value)) changed();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const field = h('label', { class: 'f' }, input);
    field.style.flex = '1';
    out.push(h('div', { class: 'row' }, field, button(t('panel.add'), add, 'btn primary')));
  } else out.push(h('p', { class: 'muted' }, t('panel.full')));

  // ── oneself ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.self')), h('p', { class: 'muted' }, t('panel.selfNote')),
    h('div', { class: 'row' }, placeSelect(p.selfPlace, false, t('panel.self'), v => { if (v && setPlace(p, -1, v)) changed(); })));

  // ── the breath ──
  const brBtn = (b: typeof BREATHS[number]) => button(t(`panel.br.${b}` as 'panel.br.even'), () => { p.breath = b; changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.breath === b) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') }, BREATHS.map(brBtn)),
    h('p', { class: 'muted' }, t(`panel.brNote.${p.breath}` as 'panel.brNote.even')));

  // ── where it goes on ──
  const walk = walkOf(p);
  const next = walk[Math.min(walk.length - 1, p.walk)];
  out.push(h('p', null, t('panel.tally', { line: tallyAll(p) })), h('p', null, t('panel.next', { name: whoName(p, next) })));
  if (p.carry) {
    const pct = Math.round(100 * (p.carry.rise > 0 ? 0.5 + 0.5 * p.carry.rise : 0.5 * p.carry.grow));
    out.push(h('p', { class: 'muted' }, t('panel.carry', { pct: t('pct', { n: pct }) })));
  }
  return out;
}
