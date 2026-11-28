/**
 * Dawid's storytelling: the contract between the code (chains.ts — which areas, quests, scenes and choices each
 * land has, and what they do) and the words (story-<land>.ts in Polish, the source, and story-<land>.<lang>.ts in
 * English, German and Swedish — the story writer's files).  A land's words are one `LandWords` object: the chapter
 * card's text, each area's name and the line said on entering it, the quest pill's words for the story's quests,
 * the names of things found or carried, the scenes (a few lines of dialogue, each with its speaker) and the
 * choices that end some scenes (two buttons and a reply to each).
 *
 * Shapes are the same in every language (the same ids, the same speakers, the same number of lines: the tests
 * compare them); a missing text falls back to Polish, then to the id, so a gap shows instead of breaking.  The
 * speakers' names live in Dawid's catalog (`who.<id>`, i18n.ts); portraits are drawn by the code (paint.ts).
 */
import { lang as pageLang, type Lang } from '../../i18n';
import type { LandId } from './content';
import { PL as pastwiskaPl } from './story-pastwiska';
import { EN as pastwiskaEn } from './story-pastwiska.en';
import { DE as pastwiskaDe } from './story-pastwiska.de';
import { SV as pastwiskaSv } from './story-pastwiska.sv';
import { PL as wzgorzaPl } from './story-wzgorza';
import { EN as wzgorzaEn } from './story-wzgorza.en';
import { DE as wzgorzaDe } from './story-wzgorza.de';
import { SV as wzgorzaSv } from './story-wzgorza.sv';
import { PL as elaPl } from './story-ela';
import { EN as elaEn } from './story-ela.en';
import { DE as elaDe } from './story-ela.de';
import { SV as elaSv } from './story-ela.sv';
import { PL as gibeaPl } from './story-gibea';
import { EN as gibeaEn } from './story-gibea.en';
import { DE as gibeaDe } from './story-gibea.de';
import { SV as gibeaSv } from './story-gibea.sv';
import { PL as engediPl } from './story-engedi';
import { EN as engediEn } from './story-engedi.en';
import { DE as engediDe } from './story-engedi.de';
import { SV as engediSv } from './story-engedi.sv';
import { PL as gatPl } from './story-gat';
import { EN as gatEn } from './story-gat.en';
import { DE as gatDe } from './story-gat.de';
import { SV as gatSv } from './story-gat.sv';

/** Who speaks a line: a portrait and a name plate (`narrator`: no portrait, the words in italics). */
export type Who = 'dawid' | 'klebek' | 'samuel' | 'jesse' | 'eliab' | 'brat' | 'dziewczyna' | 'starzec'
  | 'asahel' | 'sluga' | 'abiszaj' | 'saul' | 'zolnierz' | 'goliat' | 'jonatan' | 'kobieta' | 'mikal' | 'chlopiec'
  | 'achimelek' | 'benajasz' | 'abigail' | 'achisz' | 'itaj' | 'szamma' | 'narrator';
export const WHO: readonly Who[] = [
  'dawid', 'klebek', 'samuel', 'jesse', 'eliab', 'brat', 'dziewczyna', 'starzec', 'asahel', 'sluga', 'abiszaj', 'saul', 'zolnierz',
  'goliat', 'jonatan', 'kobieta', 'mikal', 'chlopiec', 'achimelek', 'benajasz', 'abigail', 'achisz', 'itaj', 'szamma', 'narrator',
];

/** One line of a scene: its speaker and the words (≤ 110 characters). */
export type SceneLine = readonly [Who, string];

/** A choice at a scene's end: two buttons (≤ 36 characters) and the reply after each (1–3 lines). */
export interface ChoiceWords {
  a: string;
  b: string;
  ra: readonly SceneLine[];
  rb: readonly SceneLine[];
}

/** A land's words (one language). */
export interface LandWords {
  /** the chapter card's text (≤ 220 characters) */
  chapter: string;
  /** each area: its name (≤ 28 characters) and the line said on entering it (≤ 110) */
  areas: Readonly<Record<string, { name: string; line: string }>>;
  /** the quest pill for the story's quests (≤ 44 characters; the code appends the count) */
  quests: Readonly<Record<string, string>>;
  /** a found or carried thing's name (≤ 24 characters, lower case) */
  things: Readonly<Record<string, string>>;
  /** the scenes: 1–6 lines each */
  scenes: Readonly<Record<string, readonly SceneLine[]>>;
  /** the choices (each ends the scene of the same id) */
  choices: Readonly<Record<string, ChoiceWords>>;
}

export const STORY: Readonly<Record<LandId, Readonly<Record<Lang, LandWords>>>> = {
  pastwiska: { pl: pastwiskaPl, en: pastwiskaEn, de: pastwiskaDe, sv: pastwiskaSv },
  wzgorza: { pl: wzgorzaPl, en: wzgorzaEn, de: wzgorzaDe, sv: wzgorzaSv },
  ela: { pl: elaPl, en: elaEn, de: elaDe, sv: elaSv },
  gibea: { pl: gibeaPl, en: gibeaEn, de: gibeaDe, sv: gibeaSv },
  engedi: { pl: engediPl, en: engediEn, de: engediDe, sv: engediSv },
  gat: { pl: gatPl, en: gatEn, de: gatDe, sv: gatSv },
};

/** A land's words in a language (the page's by default). */
export const landWords = (land: LandId, l: Lang = pageLang): LandWords => STORY[land][l] ?? STORY[land].pl;

const pl = (land: LandId): LandWords => STORY[land].pl;

/** The chapter card's text. */
export const chapterText = (land: LandId, l: Lang = pageLang): string => landWords(land, l).chapter || pl(land).chapter;
/** An area's name. */
export const areaName = (land: LandId, area: string, l: Lang = pageLang): string =>
  landWords(land, l).areas[area]?.name ?? pl(land).areas[area]?.name ?? area;
/** The line said on entering an area. */
export const areaLine = (land: LandId, area: string, l: Lang = pageLang): string =>
  landWords(land, l).areas[area]?.line ?? pl(land).areas[area]?.line ?? '';
/** A story quest's pill. */
export const questWords = (land: LandId, id: string, l: Lang = pageLang): string =>
  landWords(land, l).quests[id] ?? pl(land).quests[id] ?? id;
/** A thing's name. */
export const thingName = (land: LandId, id: string, l: Lang = pageLang): string =>
  landWords(land, l).things[id] ?? pl(land).things[id] ?? id;
/** A scene's lines (none: an empty scene, which the game skips). */
export const sceneLines = (land: LandId, id: string, l: Lang = pageLang): readonly SceneLine[] =>
  landWords(land, l).scenes[id] ?? pl(land).scenes[id] ?? [];
/** A choice's words (null: the scene has none in the words — it ends without a choice). */
export const choiceWords = (land: LandId, id: string, l: Lang = pageLang): ChoiceWords | null =>
  landWords(land, l).choices[id] ?? pl(land).choices[id] ?? null;
