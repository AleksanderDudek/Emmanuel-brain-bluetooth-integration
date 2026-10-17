/**
 * Task bank for the balance trainer (TypeScript port of the bank in
 * dashboard/fnirs-balance.js).  Left-hemisphere tasks are verbal / arithmetic
 * / sequential, right-hemisphere tasks spatial / imagery / holistic — a
 * simplification of prefrontal lateralisation, flagged in the UI.
 */
import type { Recommendation } from '../core/types';

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

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const WORDS = ['KOMPUTER', 'OKULARY', 'TRAMWAJ', 'KALENDARZ', 'PARASOL', 'CZEKOLADA', 'BIBLIOTEKA', 'TELEFON', 'POMARAŃCZA'];
const INITIALS = 'ABDGKLMNPRSTWZ'.split('');
const ROT_LETTERS = ['R', 'F', 'G', 'J', 'L', 'P'];   // no mirror symmetry
const ANGLES = [45, 90, 135, 180, 225, 270, 315];

export const LEFT_TASKS: Gen[] = [
  () => { const a = rnd(12, 89), b = rnd(11, 79); return { kind: 'answer', prompt: `${a} + ${b} = ?`, answer: a + b }; },
  () => { const a = rnd(41, 99), b = rnd(11, a - 11); return { kind: 'answer', prompt: `${a} − ${b} = ?`, answer: a - b }; },
  () => { const a = rnd(3, 9), b = rnd(4, 12); return { kind: 'answer', prompt: `${a} × ${b} = ?`, answer: a * b }; },
  () => { const s = rnd(60, 120), k = pick([3, 4, 6, 7]); return { kind: 'answer', prompt: `${s} − ${k} − ${k} − ${k} = ?`, answer: s - 3 * k }; },
  () => ({ kind: 'open', prompt: `Odejmuj w myślach po ${pick([3, 7, 9])}, zaczynając od ${rnd(100, 300)}.`, hint: 'Licz w swoim tempie, bez pośpiechu.' }),
  () => ({ kind: 'open', prompt: `Wymień w myślach jak najwięcej słów na literę „${pick(INITIALS)}”.`, hint: 'Spróbuj przekroczyć 10 słów.' }),
  () => { const w = pick(WORDS); return { kind: 'reveal', prompt: `Przeliteruj od tyłu: ${w}`, answer: [...w].reverse().join('') }; },
  () => ({ kind: 'open', prompt: 'Ułóż w myślach zdanie, w którym każde słowo zaczyna się na tę samą literę.', hint: 'Np. „Pies przyniósł piłkę pod płot”.' }),
];

export const RIGHT_TASKS: Gen[] = [
  () => ({ kind: 'rotation', prompt: 'Obróć literę w wyobraźni do pionu. Jest normalna czy lustrzana?',
           letter: pick(ROT_LETTERS), angle: pick(ANGLES), mirrored: Math.random() < 0.5 }),
  () => ({ kind: 'open', prompt: 'Przejdź w wyobraźni przez swoje mieszkanie i policz wszystkie okna.', hint: 'Zobacz każde pomieszczenie — nie wyliczaj słowami.' }),
  () => ({ kind: 'reveal', prompt: 'Sześcian pomalowany na czerwono pocięto na 27 równych kostek. Ile kostek ma pomalowane dokładnie 3 ściany?', answer: '8 — narożniki' }),
  () => ({ kind: 'open', prompt: 'Odtwórz w myślach znaną melodię, np. „Sto lat”. Usłysz ją jak najwyraźniej, bez słów.', hint: 'Skup się na rytmie i wysokości dźwięków.' }),
  () => ({ kind: 'open', prompt: 'Przypomnij sobie twarz bliskiej osoby: oczy, uśmiech, fryzurę.', hint: 'Obraz, nie opis.' }),
  () => ({ kind: 'open', prompt: 'Wyobraź sobie zachód słońca nad morzem: kolory nieba, ruch fal, światło na wodzie.', hint: 'Pozwól obrazowi płynąć.' }),
  () => ({ kind: 'open', prompt: 'Przejdź w myślach trasę z domu do najbliższego sklepu, widząc każdy zakręt.', hint: 'Zwróć uwagę, gdzie skręcasz w lewo, a gdzie w prawo.' }),
  () => ({ kind: 'open', prompt: 'Wyobraź sobie kostkę do gry i obracaj ją powoli we wszystkich kierunkach.', hint: 'Śledź, gdzie wędruje szóstka.' }),
];

export const FOCUS = {
  prompt: 'Skieruj uwagę na punkt na środku czoła, tuż nad nasadą nosa.',
  steps: ['Oddychaj spokojnie i równo.',
          'Zauważaj wrażenia z tego miejsca: ciepło, mrowienie, pulsowanie, nacisk opaski.',
          'Gdy myśli odpłyną, łagodnie wróć do punktu.'],
};

let seq = 0;

export function makeTask(rec: Recommendation, avoidPrompt?: string): Task {
  if (rec === 'focus') return { id: ++seq, rec, kind: 'focus', ...FOCUS };
  const bank = rec === 'train_left' ? LEFT_TASKS : RIGHT_TASKS;
  let t = pick(bank)();
  for (let i = 0; i < 4 && t.prompt === avoidPrompt; i++) t = pick(bank)();   // no immediate repeat
  return { id: ++seq, rec, ...t };
}

export function checkAnswer(task: Task, value: string): boolean | null {
  if (task.kind === 'answer') return Number.parseInt(value.trim(), 10) === task.answer;
  if (task.kind === 'rotation') return (value === 'mirror') === task.mirrored;
  return null;
}
