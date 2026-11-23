/**
 * Każda myśl's "Postępy" card in the lobby (DESIGN §19), from the app's shared classes (styles.css):
 *
 *   the numbers      thoughts given in all, sessions, the most in one session, own thoughts given
 *   how heavy        "Jak ciężko jest teraz?" 0–10 before the next session (the finale asks again), and the last few
 *                    before → after — self-report, said so
 *   what weighs      the emotion (I do not know — all; fear; sadness; anger; mixed) and the areas of life (none: all)
 *   own thoughts     up to 8, ≤ 80 characters, each with its feeling; kept only on this device; they come first;
 *                    "forget once burned", "forget all"; a thought that sounds like a crisis brings the help line
 *                    forward, right there (never blocks, never judges)
 *   set aside        the library thoughts marked "not mine", with "bring back"
 *   the breath       the rest's rhythm: the kit's presets as one-tap chips (4 · 6 by default)
 *   care             attention and imagination training, not therapy; the help line in this language
 *
 * Built with h(); every own thought is set as text (never markup).  A choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, sameBreath } from '../kit/breath';
import { AREAS, CHOICES, EMOS, OWN_CHARS, OWN_EMOS, OWN_MAX, needsCare, type OwnEmo } from './content';
import { breathWords, emoName, t, type Key } from './i18n';
import {
  addOwn, allAreas, bestOf, breathOf, forgetOwn, lastWeights, removeOwn, restoreSkipped, setBefore, setBreath, setEmotion, setOwnEmo, toggleArea,
  type MysliProgress,
} from './meta';
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

export function progressPanel(p: MysliProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  let note = '';
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => { save(); render(); }, note, msg => { note = msg; save(); render(); note = ''; })) root.appendChild(el);
  };
  render();
  return root;
}

/** An emotion select for an own thought. */
function emoSelect(value: OwnEmo, label: string, onChange: (e: OwnEmo) => void): HTMLSelectElement {
  const sel = h('select', { 'aria-label': label },
    ...OWN_EMOS.map(e => h('option', { value: e, selected: value === e ? '' : null }, t(`ownEmo.${e}` as Key)))) as HTMLSelectElement;
  sel.style.minHeight = '44px';
  sel.addEventListener('change', () => onChange(sel.value as OwnEmo));
  return sel;
}

function build(p: MysliProgress, changed: () => void, note: string, told: (msg: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.burned'), fmtNum(p.burned)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.ownBurned'), fmtNum(p.ownBurned))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── how heavy is it now ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.before')));
  const row = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.before') });
  for (let i = 0; i <= 10; i++) {
    const on = p.before === i;
    row.append(button(String(i), () => { setBefore(p, on ? null : i); changed(); }, on ? 'btn on' : 'btn', {
      role: 'radio', 'aria-checked': String(on), 'aria-label': t('panel.weightOf', { n: i }),
    }));
  }
  out.push(row, h('p', { class: 'muted' }, p.before !== null ? `${t('panel.beforeSet', { n: p.before })} · ${t('panel.beforeNote')}` : t('panel.beforeNote')));
  const hist = lastWeights(p);
  if (hist.length) out.push(h('p', null, `${t('panel.history')}: ${hist.map(w => (w.before === null ? `${w.after}/10` : `${w.before} → ${w.after}`)).join(' · ')}`));

  // ── what weighs today ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.emotion')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.emotion') },
      CHOICES.map(c => button(t(`choice.${c}` as Key), () => { if (setEmotion(p, c)) changed(); }, p.emotion === c ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.emotion === c) }))),
    h('p', { class: 'muted' }, t('panel.emotionNote')));
  out.push(h('div', { class: 'arcade-sub' }, t('panel.areas')),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.areas') },
      button(t('panel.allAreas'), () => { allAreas(p); changed(); }, p.areas.length === 0 ? 'btn on' : 'btn', { 'aria-pressed': String(p.areas.length === 0) }),
      ...AREAS.map(a => {
        const on = p.areas.includes(a);
        return button(t(`area.${a}` as Key), () => { if (toggleArea(p, a)) changed(); }, on ? 'btn on' : 'btn', { 'aria-pressed': String(on) });
      })),
    h('p', { class: 'muted' }, t('panel.areasNote')));

  // ── own thoughts ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.own')), h('p', { class: 'muted' }, t('panel.ownNote')));
  if (!p.own.length) out.push(h('p', null, t('panel.ownEmpty')));
  p.own.forEach((o, i) => {
    const text = h('span', { class: 'grow' }, o.text);
    text.style.overflowWrap = 'anywhere';
    out.push(h('div', { class: 'row', role: 'group', 'aria-label': o.text },
      text,
      emoSelect(o.emo, `${o.text}: ${t('panel.ownEmo')}`, e => { if (setOwnEmo(p, i, e)) changed(); }),
      button('✕', () => { if (removeOwn(p, i)) changed(); }, 'btn', { 'aria-label': t('panel.remove', { text: o.text }) })));
  });
  if (p.own.some(o => needsCare(o.text))) out.push(h('p', { class: 'task-feedback bad', role: 'note' }, t('panel.careOwn')));
  if (p.own.length >= OWN_MAX) out.push(h('p', { class: 'muted' }, t('panel.ownFull')));
  else {
    const input = h('input', { type: 'text', maxlength: String(OWN_CHARS), placeholder: t('panel.ownPh'), 'aria-label': t('panel.ownPh'), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    input.style.minHeight = '44px';
    let emo: OwnEmo = 'mixed';
    const sel = emoSelect(emo, t('panel.ownEmo'), e => { emo = e; });
    const add = () => {
      if (addOwn(p, input.value, emo)) changed();
      else input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    out.push(h('div', { class: 'row' }, h('label', { class: 'f grow' }, input), sel, button(t('panel.ownAdd'), add, 'btn primary')));
  }
  const forget = h('label', { class: 'row' });
  const box = h('input', { type: 'checkbox', checked: p.forgetBurned ? '' : null }) as HTMLInputElement;
  box.style.minWidth = '24px';
  box.style.minHeight = '24px';
  box.addEventListener('change', () => { p.forgetBurned = box.checked; changed(); });
  forget.append(box, h('span', null, t('panel.forgetBurned')));
  out.push(forget);
  if (p.own.length) out.push(h('div', { class: 'row' }, button(t('panel.forgetAll'), () => { forgetOwn(p); told(t('panel.forgotten')); }, 'btn ghost')));
  if (note) out.push(h('p', { class: 'muted', role: 'status' }, note));

  // ── set aside ──
  if (p.skipped.length) {
    out.push(h('div', { class: 'row' }, h('span', { class: 'grow' }, t('panel.skipped', { n: p.skipped.length })),
      button(t('panel.restore'), () => { restoreSkipped(p); changed(); }, 'btn')));
  }

  // ── the breath ──
  const b = breathOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
      Object.entries(BREATH_PRESETS).map(([k, pat]) => button(t(`preset.${k}` as Key), () => { setBreath(p, pat); changed(); }, sameBreath(b, pat) ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(sameBreath(b, pat)) }))),
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
