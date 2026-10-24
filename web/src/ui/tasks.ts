/**
 * Task bank for the balance trainer (TypeScript port of the bank in
 * dashboard/fnirs-balance.js).  Left-hemisphere tasks are verbal / arithmetic
 * / sequential, right-hemisphere tasks spatial / imagery / holistic — a
 * simplification of prefrontal lateralisation, flagged in the UI.
 *
 * The verbal tasks are written for each language, not translated: a letter to
 * find words for is one that many everyday words start with in that language,
 * the words to spell backwards are its own, and the examples (an alliteration,
 * a melody) are ones its speakers know — see TASK_LANGUAGES and src/i18n/training.ts.
 */
import type { Recommendation } from '../core/types';
import { lang, type Lang } from '../i18n';
import { t } from '../i18n/training';

export type TaskKind = 'answer' | 'open' | 'reveal' | 'rotation' | 'focus';

export interface Task {
  id: number;
  rec: Recommendation;
  kind: TaskKind;
  prompt: string;
  hint?: string;
  answer?: number | string;
  letter?: string;
  angle?: number;
  mirrored?: boolean;
  steps?: string[];
}

type Gen = () => Omit<Task, 'id' | 'rec'>;

/** What the verbal tasks need from a language. */
export interface TaskLanguage {
  /** starting letters with plenty of everyday words (no Q, X, Y, and none that only loanwords use) */
  initials: string;
  /** everyday words of 7–11 letters to spell backwards, in capitals */
  words: readonly string[];
}

export const TASK_LANGUAGES: Readonly<Record<Lang, TaskLanguage>> = {
  pl: {
    initials: 'ABDGKLMNPRSTWZ',
    words: ['KOMPUTER', 'OKULARY', 'TRAMWAJ', 'KALENDARZ', 'PARASOL', 'CZEKOLADA', 'BIBLIOTEKA', 'TELEFON', 'POMARAŃCZA'],
  },
  en: {
    initials: 'ABCDFGHLMPRSTW',
    words: ['UMBRELLA', 'ELEPHANT', 'KITCHEN', 'BLANKET', 'LIBRARY', 'CHOCOLATE', 'PINEAPPLE', 'BICYCLE', 'MOUNTAIN', 'TELEPHONE'],
  },
  de: {
    initials: 'ABDFGHKLMNPRSTWZ',
    words: ['FAHRRAD', 'KALENDER', 'SCHOKOLADE', 'BIBLIOTHEK', 'REGENSCHIRM', 'KARTOFFEL', 'FENSTER', 'ERDBEERE', 'GEBURTSTAG', 'TELEFON'],
  },
  sv: {
    initials: 'ABDFGHKLMNPRSTV',
    words: ['PARAPLY', 'BIBLIOTEK', 'CHOKLAD', 'KALENDER', 'APELSIN', 'JORDGUBBE', 'KANELBULLE', 'TELEFON', 'FÖNSTER', 'SOMMARSTUGA'],
  },
};

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const here = TASK_LANGUAGES[lang];
const INITIALS = here.initials.split('');
const ROT_LETTERS = ['R', 'F', 'G', 'J', 'L', 'P'];   // no mirror symmetry
const ANGLES = [45, 90, 135, 180, 225, 270, 315];

export const LEFT_TASKS: Gen[] = [
  () => { const a = rnd(12, 89), b = rnd(11, 79); return { kind: 'answer', prompt: `${a} + ${b} = ?`, answer: a + b }; },
  () => { const a = rnd(41, 99), b = rnd(11, a - 11); return { kind: 'answer', prompt: `${a} − ${b} = ?`, answer: a - b }; },
  () => { const a = rnd(3, 9), b = rnd(4, 12); return { kind: 'answer', prompt: `${a} × ${b} = ?`, answer: a * b }; },
  () => { const s = rnd(60, 120), k = pick([3, 4, 6, 7]); return { kind: 'answer', prompt: `${s} − ${k} − ${k} − ${k} = ?`, answer: s - 3 * k }; },
  () => ({ kind: 'open', prompt: t('task.subtract', { step: pick([3, 7, 9]), start: rnd(100, 300) }), hint: t('task.subtractHint') }),
  () => ({ kind: 'open', prompt: t('task.letter', { letter: pick(INITIALS) }), hint: t('task.letterHint') }),
  () => { const w = pick(here.words); return { kind: 'reveal', prompt: t('task.backwards', { word: w }), answer: [...w].reverse().join('') }; },
  () => ({ kind: 'open', prompt: t('task.alliteration'), hint: t('task.alliterationHint') }),
];

export const RIGHT_TASKS: Gen[] = [
  () => ({ kind: 'rotation', prompt: t('task.rotation'), letter: pick(ROT_LETTERS), angle: pick(ANGLES), mirrored: Math.random() < 0.5 }),
  () => ({ kind: 'open', prompt: t('task.windows'), hint: t('task.windowsHint') }),
  () => ({ kind: 'reveal', prompt: t('task.cube'), answer: t('task.cubeAnswer') }),
  () => ({ kind: 'open', prompt: t('task.melody'), hint: t('task.melodyHint') }),
  () => ({ kind: 'open', prompt: t('task.face'), hint: t('task.faceHint') }),
  () => ({ kind: 'open', prompt: t('task.sunset'), hint: t('task.sunsetHint') }),
  () => ({ kind: 'open', prompt: t('task.route'), hint: t('task.routeHint') }),
  () => ({ kind: 'open', prompt: t('task.dice'), hint: t('task.diceHint') }),
];

export const FOCUS = {
  prompt: t('task.focus'),
  steps: [t('task.focusStep1'), t('task.focusStep2'), t('task.focusStep3')],
};

let seq = 0;

export function makeTask(rec: Recommendation, avoidPrompt?: string): Task {
  if (rec === 'focus') return { id: ++seq, rec, kind: 'focus', ...FOCUS };
  const bank = rec === 'train_left' ? LEFT_TASKS : RIGHT_TASKS;
  let task = pick(bank)();
  for (let i = 0; i < 4 && task.prompt === avoidPrompt; i++) task = pick(bank)();   // no immediate repeat
  return { id: ++seq, rec, ...task };
}

export function checkAnswer(task: Task, value: string): boolean | null {
  if (task.kind === 'answer') return Number.parseInt(value.trim(), 10) === task.answer;
  if (task.kind === 'rotation') return (value === 'mirror') === task.mirrored;
  return null;
}
