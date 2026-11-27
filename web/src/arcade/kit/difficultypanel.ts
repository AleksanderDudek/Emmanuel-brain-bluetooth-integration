/**
 * The lobby's difficulty row (kit/difficulty.ts, DESIGN.md §29): four chips — Na start · Zwykły · Zaawansowany ·
 * Hardcore — and a line under them saying what the chosen level means in this game (the game's own words; the shared
 * line when it gives none) and that the training itself is the same at every level.  A game's `progressPanel` puts it
 * at the top of its card: `difficultyPanel({ value: p.difficulty, onChange: d => { p.difficulty = d; save(); } })`.
 * Built with h() and the app's classes (.field, .seg, .btn); the chips are a radiogroup and keep the keyboard's focus.
 */
import { lang as pageLang, translator, type Catalog, type Lang } from '../../i18n';
import { h } from '../../ui/dom';
import { DIFFICULTIES, type Difficulty } from './difficulty';

type Key = 'title' | 'same' | `name.${Difficulty}` | `line.${Difficulty}`;

const pl: Catalog<Key> = {
  title: 'Poziom trudności',
  same: 'Trening skupienia jest ten sam na każdym poziomie — zmienia się tylko gra.',
  'name.start': 'Na start', 'name.regular': 'Zwykły', 'name.advanced': 'Zaawansowany', 'name.hardcore': 'Hardcore',
  'line.start': 'Słabsi przeciwnicy, więcej zdrowia i pomocy — na pierwsze sesje i spokojną grę.',
  'line.regular': 'Gra taka, jak została zaprojektowana.',
  'line.advanced': 'Silniejsi i liczniejsi przeciwnicy, mniej pomocy, trochę większe nagrody.',
  'line.hardcore': 'Najtrudniej: bez pomocy, przeciwnicy dwa razy silniejsi. Liczy się każda chwila skupienia.',
};
const en: Catalog<Key> = {
  title: 'Difficulty',
  same: 'The focus training is the same at every level — only the game changes.',
  'name.start': 'Starting', 'name.regular': 'Regular', 'name.advanced': 'Advanced', 'name.hardcore': 'Hardcore',
  'line.start': 'Weaker foes, more health and help — for first sessions and an easy game.',
  'line.regular': 'The game as it was designed.',
  'line.advanced': 'Stronger and more foes, fewer helps, slightly bigger rewards.',
  'line.hardcore': 'The hardest: no helps, foes twice as strong. Every moment of focus counts.',
};
const de: Catalog<Key> = {
  title: 'Schwierigkeit',
  same: 'Das Fokustraining ist auf jeder Stufe gleich — nur das Spiel ändert sich.',
  'name.start': 'Einstieg', 'name.regular': 'Normal', 'name.advanced': 'Fortgeschritten', 'name.hardcore': 'Hardcore',
  'line.start': 'Schwächere Gegner, mehr Gesundheit und Hilfe — für die ersten Sitzungen und ein ruhiges Spiel.',
  'line.regular': 'Das Spiel, wie es gedacht ist.',
  'line.advanced': 'Stärkere und mehr Gegner, weniger Hilfe, etwas größere Belohnungen.',
  'line.hardcore': 'Am schwersten: keine Hilfe, Gegner doppelt so stark. Jeder Moment des Fokus zählt.',
};
const sv: Catalog<Key> = {
  title: 'Svårighetsgrad',
  same: 'Fokusträningen är densamma på varje nivå — bara spelet ändras.',
  'name.start': 'Nybörjare', 'name.regular': 'Normal', 'name.advanced': 'Avancerad', 'name.hardcore': 'Hardcore',
  'line.start': 'Svagare motståndare, mer hälsa och hjälp — för de första passen och ett lugnt spel.',
  'line.regular': 'Spelet som det är tänkt.',
  'line.advanced': 'Starkare och fler motståndare, mindre hjälp, något större belöningar.',
  'line.hardcore': 'Svårast: ingen hjälp, motståndare dubbelt så starka. Varje stund av fokus räknas.',
};

export const DIFFICULTY_WORDS: Readonly<Record<Lang, Catalog<Key>>> = { pl, en, de, sv };
const tr = translator<Key>(DIFFICULTY_WORDS);
const words = (l: Lang): ((k: Key) => string) => (l === pageLang ? k => tr(k) : k => String(DIFFICULTY_WORDS[l][k] ?? pl[k]));

/** A level's name in the page's language (for a summary line: "Poziom: Hardcore"). */
export const difficultyName = (d: Difficulty, l: Lang = pageLang): string => words(l)(`name.${d}`);

export interface DifficultyPanelOpts {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  /** what the level means in this game (in the page's language), else the shared line */
  line?: (d: Difficulty) => string | null;
  lang?: Lang;
}

/** The difficulty row: a root element that redraws itself on a change. */
export function difficultyPanel(o: DifficultyPanelOpts): HTMLElement {
  const t = words(o.lang ?? pageLang);
  let value = o.value;
  const root = h('div', { class: 'field difficulty' });
  const render = (): void => {
    const chips = h('div', { class: 'seg difficulty-chips', role: 'radiogroup', 'aria-label': t('title') },
      DIFFICULTIES.map(d => {
        const b = h('button', { class: 'btn', type: 'button', role: 'radio', 'aria-checked': String(d === value), 'data-difficulty': d }, t(`name.${d}`));
        b.addEventListener('click', e => {
          e.preventDefault();
          if (d === value) return;
          value = d;
          o.onChange(d);
          render();
          root.querySelector<HTMLElement>(`[data-difficulty="${d}"]`)?.focus();
        });
        return b;
      }));
    root.replaceChildren(
      h('span', {}, t('title')),
      chips,
      h('p', { class: 'muted difficulty-line' }, o.line?.(value) ?? t(`line.${value}`)),
      h('p', { class: 'muted difficulty-same' }, t('same')),
    );
  };
  render();
  return root;
}
