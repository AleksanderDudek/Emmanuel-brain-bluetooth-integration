/**
 * The Wiedza tab's articles (DESIGN.md §15): data, not prose in components.  A reference list that is the same in
 * every language (refs.ts) and one article file per language (pfc-pl.ts, pfc-en.ts, …) with the same section ids,
 * loaded lazily by src/ui/wiedza.ts.  Every research point cites reference keys; the view numbers them in the order
 * they first appear and links each number to the list at the end.
 */

/** meta-analysis · systematic review · (narrative) review · a single study (only where no review gives the point) */
export type RefType = 'meta' | 'sysrev' | 'review' | 'study';

export interface Ref {
  key: string;
  /** "Miller & Cohen", "Buhle et al." */
  authors: string;
  year: number;
  title: string;
  /** the journal's abbreviation as PubMed gives it, with volume and pages */
  journal: string;
  type: RefType;
  /** PubMed id: https://pubmed.ncbi.nlm.nih.gov/<pmid>/ */
  pmid: string;
  doi: string;
}

/** How sure the research is about a section's main claims. */
export type Strength = 'strong' | 'moderate' | 'early';

/** One "what the research says" line; `refs` are keys of REFS (empty only for a plain caution). */
export interface Point {
  text: string;
  refs: readonly string[];
}

export const SECTION_IDS = [
  'what', 'executive', 'attention', 'emotion', 'stress', 'anxiety', 'depression', 'decisions',
  'social', 'sleep', 'exercise', 'prayer', 'life', 'neurofeedback', 'practice',
] as const;
export type SectionId = typeof SECTION_IDS[number];

/** In-app links an article may point to (the view names them). */
export type AppLink = '#sygnal' | '#trening' | '#trening/focus' | '#gry' | `#gra/${string}`;

export interface Section {
  id: SectionId;
  title: string;
  /** "in short": one line */
  short: string;
  /** 2–4 short paragraphs; a paragraph may end with cited keys */
  body: readonly Point[];
  /** 3–6 points */
  points: readonly Point[];
  strength?: Strength;
  /** "what it means for you": one line */
  forYou: string;
  link?: AppLink;
}

export interface Article {
  /** the eyebrow over the title */
  kicker: string;
  title: string;
  lede: string;
  /** "what your band sees" */
  band: {
    title: string;
    intro: string;
    fnirs: { title: string; text: string };
    eeg: { title: string; text: string };
    points: readonly Point[];
  };
  sections: readonly Section[];
  /** "the limits of this knowledge" */
  limits: { title: string; points: readonly Point[] };
  /** when the literature was last reviewed: YYYY-MM */
  reviewed: string;
}
