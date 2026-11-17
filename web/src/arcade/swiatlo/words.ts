/** Światło ciała's element words in the four languages (words-pl.ts is the source). */
import { DE } from './words-de';
import { EN } from './words-en';
import { PL } from './words-pl';
import { SV } from './words-sv';

export interface ElementWords { name: Record<string, string>; guide: Record<string, string>; fact: Record<string, string> }

export const WORDS: Readonly<Record<'pl' | 'en' | 'de' | 'sv', ElementWords>> = { pl: PL, en: EN, de: DE, sv: SV };
