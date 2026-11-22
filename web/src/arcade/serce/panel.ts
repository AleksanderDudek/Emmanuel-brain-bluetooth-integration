/**
 * Z głowy do serca's "Postępy" card in the lobby (DESIGN.md §18), from the app's shared classes (styles.css):
 *
 *   the numbers     the most lights, sessions, whole ways, the furthest ring
 *   where you begin "Dalej od kręgu przyjaciół" (where the last session stopped) or "Od pierwszego kręgu"
 *   Twoje kręgi     names or initials for rings 1–4 (comma-separated, up to 8 a ring, 24 characters each), plain text,
 *                   kept only on this device; ring 4 with its care note and "leave this circle out today"
 *   the heart word  the Jesus Prayer, "Jezu", "Abba, Ojcze", "Maranatha", or own words (≤ 60 characters)
 *   the breath      the rests' breath as presets (5 · 5 by default)
 *
 * Built with h(); a choice saves the progress and redraws the card.  Text the player types is set as text, never as
 * markup.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, sameBreath } from '../kit/breath';
import { dayKey } from '../kit/progress';
import { WORDS, cleanOwn, fromRing, ringName, wordName, type Ring } from './content';
import { t, type Key } from './i18n';
import { bestOf, clearStart, namesOf, setBreath, setNames, setOwn, setSkip4, setWord, skip4Today, type SerceProgress } from './meta';
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
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  return b;
}

export function progressPanel(p: SerceProgress, save: () => void): HTMLElement {
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

/** One ring's names: a text field (comma-separated) with its count, saved on Enter or "Zapisz". */
function namesField(p: SerceProgress, r: Ring, changed: () => void): HTMLElement[] {
  const input = h('input', {
    type: 'text', maxlength: String(RULES.namesMax * (RULES.nameMax + 2)), placeholder: t('panel.namesPh'), 'aria-label': `${t('panel.circles')}: ${ringName(r)}`,
    autocomplete: 'off', autocapitalize: 'words',
  }) as HTMLInputElement;
  input.value = namesOf(p, r).join(', ');
  const count = h('span', { class: 'muted' }, t('panel.namesCount', { n: namesOf(p, r).length }));
  const keep = () => {
    setNames(p, r, input.value);
    changed();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
  input.addEventListener('change', keep);
  const row = h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary'));
  if (namesOf(p, r).length) row.append(button(t('panel.clear'), () => { setNames(p, r, ''); changed(); }, 'btn ghost'));
  return [h('label', { class: 'f' }, h('span', null, `${r} · ${ringName(r)} — `, count), input), row];
}

function build(p: SerceProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.ways'), fmtNum(p.ways)),
    stat(t('panel.reach'), p.reach >= 1 ? t('sub.ring', { n: p.reach }) : p.reach === 0 ? ringName(0) : '—')));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── where you begin ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.start')));
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.start') });
  if (p.pos) seg.append(button(t('panel.continue', { from: fromRing(p.pos.ring) }), () => undefined, 'btn', { role: 'radio', 'aria-checked': 'true' }));
  seg.append(button(t('panel.fromTop'), () => { clearStart(p); changed(); }, 'btn', { role: 'radio', 'aria-checked': String(!p.pos) }));
  out.push(seg, h('p', { class: 'muted' }, t('panel.startNote')));

  // ── your circles ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.circles')), h('p', { class: 'muted' }, t('panel.circlesNote')));
  for (const r of [1, 2, 3] as Ring[]) out.push(...namesField(p, r, changed));
  // ring 4, with care
  const day = dayKey();
  const skip = skip4Today(p, day);
  out.push(h('p', null, t('panel.ring4Note')));
  out.push(...namesField(p, 4, changed));
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.skip4') }) as HTMLInputElement;
  box.checked = skip;
  box.addEventListener('change', () => {
    setSkip4(p, day, box.checked);
    changed();
  });
  out.push(h('label', { class: 'switch' }, box, h('span', null, t('panel.skip4'))));
  if (skip) out.push(h('p', { class: 'muted' }, t('panel.skip4On')));

  // ── the words of the heart ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.word')), h('p', { class: 'muted' }, t('panel.wordNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.word') },
    WORDS.map(w => button(wordName(w), () => { setWord(p, w); changed(); }, p.word === w ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.word === w) }))));
  if (p.word === 'own') {
    const input = h('input', { type: 'text', maxlength: String(RULES.ownMax), placeholder: t('panel.ownPh'), 'aria-label': wordName('own'), autocomplete: 'off' }) as HTMLInputElement;
    input.value = p.own;
    const count = h('span', null, t('panel.ownCount', { n: [...input.value].length }));
    input.addEventListener('input', () => { count.textContent = t('panel.ownCount', { n: [...cleanOwn(input.value)].length }); });
    const keep = () => { setOwn(p, input.value); changed(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
    out.push(h('p', { class: 'muted' }, t('panel.ownNote')), h('label', { class: 'f' }, count, input), h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary')));
  }

  // ── the breath ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
    (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
      const on = sameBreath(p.breath, pat);
      return button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
    })));
  out.push(h('p', { class: 'muted' }, t('panel.privacy')));
  return out;
}
