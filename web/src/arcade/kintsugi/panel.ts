/**
 * Złote serce's "Postępy" card in the lobby (DESIGN.md §21), from the app's shared classes (styles.css):
 *
 *   the numbers    the most golden seams, sessions, pieces gathered, golden hearts
 *   the way        how it goes (only focus lifts, lays and pours; rest washes) and this session's forecast for the
 *                  lobby's length: "Na 10 min: serce pęknięte na 7 kawałków, każdy obmyty w 2 oddechach" (the same
 *                  plan the session follows, rules.ts), and how many the average player lifts when grace gathers the rest
 *   Co boli?       the words on the pieces: five gentle sets (their words shown), own words (≤ 14, kept only on this
 *                  device, "Zapomnij moje słowa"), or none
 *   how it hurts   0–10 now, for this session (the player's own sense, not a measurement), and the last before → after
 *   the breath     the rests' breath as presets (5 · 5 by default)
 *   care           not therapy, the help lines; what stays on the device
 *   the music      builder B's section (music/index.ts `musicPanel`)
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h(); a choice saves the progress and redraws the card.  Text the player types is set
 * as text, never as markup.
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, breathCycle, sameBreath } from '../kit/breath';
import { OWN_LEN, OWN_MAX, SET_LEN, WORD_CHOICES, WORD_SETS, cleanWords, type WordChoice } from './content';
import { t, type Key } from './i18n';
import { bestOf, forgetOwn, setBefore, setBreath, setOwn, setWords, type KintsugiProgress } from './meta';
import { musicPanel } from './music/index';
import { planFor } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string | Node[], onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, ...(Array.isArray(text) ? text : [text]));
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  return b;
}

/** The session length the lobby has chosen (s): the checked minutes, else the last session's, else 5 minutes. */
export function sessionSec(p: KintsugiProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm, the player's breath). */
export function forecastLines(p: KintsugiProgress, sec: number): string[] {
  const plan = planFor({ plannedSec: sec, cyc: breathCycle(p.breath), eeg: false });
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const out = [t('panel.fc', { min, n: plan.pieces, wash: t('washIn', { n: plan.wash }) })];
  if (plan.planned < plan.pieces) out.push(t('panel.fcGrace', { n: plan.planned }));
  return out;
}

/** The card whose forecast follows the lobby's session length (the latest one built). */
let refresh: (() => void) | null = null;
let hooked = false;
function hookLength(): void {
  if (hooked || typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box) return;
  hooked = true;
  // the lobby marks the chosen length on the button first; this runs as the click bubbles
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: KintsugiProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const music = musicPanel(p.music, save, () => sessionSec(p));
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, fc, () => {
      save();
      render();
    })) root.appendChild(el);
    fc.textContent = forecastLines(p, sessionSec(p)).join(' ');
    // the music's own section keeps its state between redraws of the card
    root.appendChild(music);
  };
  render();
  refresh = () => { if (fc.isConnected) fc.textContent = forecastLines(p, sessionSec(p)).join(' '); };
  hookLength();
  return root;
}

/** The set's words as one muted line ("tęsknota · samotność · …"). */
function setWordsLine(set: (typeof WORD_SETS)[number]): string {
  return Array.from({ length: SET_LEN }, (_, i) => t(`w.${set}.${i + 1}` as Key)).join(' · ');
}

function build(p: KintsugiProgress, fc: HTMLElement, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.pieces'), fmtNum(p.pieces + p.grace)),
    stat(t('panel.golden'), fmtNum(p.golden))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), fc);

  // ── what hurts: the words on the pieces ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.words')), h('p', { class: 'muted' }, t('panel.wordsNote')));
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.words') },
    WORD_CHOICES.map((w: WordChoice) => button(t(`set.${w}` as Key), () => { setWords(p, w); changed(); }, p.words === w ? 'btn on' : 'btn', {
      role: 'radio', 'aria-checked': String(p.words === w),
    })));
  seg.style.flexWrap = 'wrap';
  out.push(seg);
  if (p.words === 'own') out.push(...ownField(p, changed));
  else if (p.words === 'none') out.push(h('p', { class: 'muted' }, t('panel.noneNote')));
  else out.push(h('p', { class: 'muted' }, setWordsLine(p.words)));

  // ── how much it hurts now ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.hurt')), h('p', { class: 'muted' }, t('panel.hurtNote')));
  const row = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.hurt') },
    Array.from({ length: 11 }, (_, n) => {
      const b = button(String(n), () => { setBefore(p, p.before === n ? null : n); changed(); }, p.before === n ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(p.before === n),
      });
      b.style.paddingLeft = '0';
      b.style.paddingRight = '0';
      return b;
    }));
  // six columns: two rows on a 360-px phone, every button at least 44 px
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'repeat(auto-fill, minmax(44px, 1fr))';
  row.style.maxWidth = '560px';
  out.push(row);
  const extras = h('div', { class: 'row' });
  if (p.before !== null) extras.append(button(t('panel.hurtClear'), () => { setBefore(p, null); changed(); }, 'btn ghost'));
  const last = p.history[p.history.length - 1];
  if (last && last.before !== null) extras.append(h('span', { class: 'muted' }, t('panel.hurtLast', { a: last.before, b: last.after })));
  if (extras.childNodes.length) out.push(extras);

  // ── the breath ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
    (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
      const on = sameBreath(p.breath, pat);
      return button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
    })));

  // ── care ──
  out.push(h('p', { class: 'muted' }, t('panel.care')), h('p', { class: 'muted' }, t('panel.privacy')));
  return out;
}

/** Own words: one line, comma-separated, saved on Enter or "Zapisz"; "Zapomnij moje słowa". */
function ownField(p: KintsugiProgress, changed: () => void): HTMLElement[] {
  const input = h('input', {
    type: 'text', maxlength: String(OWN_MAX * (OWN_LEN + 2)), placeholder: t('panel.ownPh'), 'aria-label': t('set.own'), autocomplete: 'off',
  }) as HTMLInputElement;
  input.value = p.own.join(', ');
  const count = h('span', null, t('panel.ownCount', { n: p.own.length }));
  input.addEventListener('input', () => { count.textContent = t('panel.ownCount', { n: cleanWords(input.value).length }); });
  const keep = () => { setOwn(p, input.value); changed(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
  const row = h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary'));
  if (p.own.length) row.append(button(t('panel.forget'), () => { forgetOwn(p); changed(); }, 'btn ghost'));
  return [h('p', { class: 'muted' }, t('panel.ownNote')), h('label', { class: 'f' }, count, input), row];
}
