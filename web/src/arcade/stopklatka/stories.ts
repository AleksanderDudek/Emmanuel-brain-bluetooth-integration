/**
 * Stop-klatka's stories as the game reads them (DESIGN.md §28): the five groups' Polish stories (the source,
 * `stories-<age>.ts`) and their en/de/sv texts (`stories-<age>.<lang>.ts`, keyed `<story id>.<field>`), joined; a
 * story's words in the page's language (each missing key falls back to the Polish); the keys a translation must have;
 * and a group's stories in the order a session tells them.
 */
import { lang as pageLang, type Lang } from '../../i18n';
import { AGES, type Age, type Story } from './story';
import { STORIES_ADULT } from './stories-adult';
import { ADULT_DE } from './stories-adult.de';
import { ADULT_EN } from './stories-adult.en';
import { ADULT_SV } from './stories-adult.sv';
import { STORIES_MID } from './stories-mid';
import { MID_DE } from './stories-mid.de';
import { MID_EN } from './stories-mid.en';
import { MID_SV } from './stories-mid.sv';
import { STORIES_SENIOR } from './stories-senior';
import { SENIOR_DE } from './stories-senior.de';
import { SENIOR_EN } from './stories-senior.en';
import { SENIOR_SV } from './stories-senior.sv';
import { STORIES_TEEN } from './stories-teen';
import { TEEN_DE } from './stories-teen.de';
import { TEEN_EN } from './stories-teen.en';
import { TEEN_SV } from './stories-teen.sv';
import { STORIES_YOUNG } from './stories-young';
import { YOUNG_DE } from './stories-young.de';
import { YOUNG_EN } from './stories-young.en';
import { YOUNG_SV } from './stories-young.sv';

export type Other = Exclude<Lang, 'pl'>;
type Texts = Readonly<Record<string, string>>;

/** Each group's stories (Polish), in the order the authors wrote them: the order a group's sessions tell them. */
export const STORIES: Readonly<Record<Age, readonly Story[]>> = {
  teen: STORIES_TEEN, young: STORIES_YOUNG, adult: STORIES_ADULT, mid: STORIES_MID, senior: STORIES_SENIOR,
};

/** Each group's translations. */
export const TRANSLATIONS: Readonly<Record<Other, Readonly<Record<Age, Texts>>>> = {
  en: { teen: TEEN_EN, young: YOUNG_EN, adult: ADULT_EN, mid: MID_EN, senior: SENIOR_EN },
  de: { teen: TEEN_DE, young: YOUNG_DE, adult: ADULT_DE, mid: MID_DE, senior: SENIOR_DE },
  sv: { teen: TEEN_SV, young: YOUNG_SV, adult: ADULT_SV, mid: MID_SV, senior: SENIOR_SV },
};

export const ALL_STORIES: readonly Story[] = AGES.flatMap(a => STORIES[a]);

const BY_ID = new Map<string, Story>(ALL_STORIES.map(s => [s.id, s]));
export const storyById = (id: string): Story | null => BY_ID.get(id) ?? null;

/** A beat's words. */
export interface BeatText { text: string; say?: string; screen?: string }

/** A story's words in one language. */
export interface StoryText {
  title: string;
  beats: BeatText[];
  trigger: string;
  urge: string;
  second: string[];
  answer: string;
  answerSay?: string;
  outcome: BeatText;
  lesson: string;
}

/** The Polish words of a story, keyed as the translations are (`<id>.title`, `<id>.b1.text`, …). */
export function sourceKeys(s: Story): Record<string, string> {
  const out: Record<string, string> = {};
  const id = s.id;
  out[`${id}.title`] = s.title;
  s.beats.forEach((b, i) => {
    out[`${id}.b${i + 1}.text`] = b.text;
    if (b.say !== undefined) out[`${id}.b${i + 1}.say`] = b.say;
    if (b.screen !== undefined) out[`${id}.b${i + 1}.screen`] = b.screen;
  });
  out[`${id}.trigger`] = s.trigger;
  out[`${id}.urge`] = s.urge;
  s.second.forEach((line, i) => { out[`${id}.second.${i + 1}`] = line; });
  out[`${id}.answer`] = s.answer;
  if (s.answerSay !== undefined) out[`${id}.answerSay`] = s.answerSay;
  out[`${id}.outcome.text`] = s.outcome.text;
  if (s.outcome.say !== undefined) out[`${id}.outcome.say`] = s.outcome.say;
  if (s.outcome.screen !== undefined) out[`${id}.outcome.screen`] = s.outcome.screen;
  out[`${id}.lesson`] = s.lesson;
  return out;
}

/** The keys a translation of `s` must have (exactly the fields the Polish story has). */
export const storyKeys = (s: Story): string[] => Object.keys(sourceKeys(s));

/** A story's words in `l` (the page's language by default); a key missing in a translation falls back to the Polish. */
export function storyText(s: Story, l: Lang = pageLang): StoryText {
  const src = sourceKeys(s);
  const tr: Texts = l === 'pl' ? {} : TRANSLATIONS[l][s.age] ?? {};
  const g = (k: string): string => {
    const v = tr[k];
    return typeof v === 'string' && v.trim() ? v : src[k];
  };
  const opt = (k: string): string | undefined => (k in src ? g(k) : undefined);
  const id = s.id;
  return {
    title: g(`${id}.title`),
    beats: s.beats.map((_, i) => ({ text: g(`${id}.b${i + 1}.text`), say: opt(`${id}.b${i + 1}.say`), screen: opt(`${id}.b${i + 1}.screen`) })),
    trigger: g(`${id}.trigger`),
    urge: g(`${id}.urge`),
    second: s.second.map((_, i) => g(`${id}.second.${i + 1}`)),
    answer: g(`${id}.answer`),
    answerSay: opt(`${id}.answerSay`),
    outcome: { text: g(`${id}.outcome.text`), say: opt(`${id}.outcome.say`), screen: opt(`${id}.outcome.screen`) },
    lesson: g(`${id}.lesson`),
  };
}

/** A group's stories a session may tell: the light ones, and the heavy ones only with the lobby's switch on. */
export function storiesFor(age: Age, heavy: boolean): Story[] {
  return STORIES[age].filter(s => heavy || !s.heavy);
}
