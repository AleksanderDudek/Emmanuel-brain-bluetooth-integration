/**
 * Złote serce's tracks (DESIGN.md §21.4): the founder's eleven, in the order he listed them, with their lengths as
 * YouTube gave them on 2026-11-24 (all may be embedded).  A title is kept as YouTube has it, shortened sensibly; the
 * performer is the artist, not the uploading channel; a note says what a track is only where that is certain
 * (the title or the channel says so): Latin chant, the prayer of St Benedict, an Orthodox choir, a Gurmukhi mantra
 * of the Sikh tradition and Kundalini yoga.  Nothing here is loaded from YouTube: the lobby shows these words only.
 */
import type { Track } from '../../kit/playlist';
import type { Key } from './i18n';

export interface BuiltinTrack extends Track {
  /** the title as YouTube has it (not translated) … */
  title: string;
  /** … or, where the title is a description, its words in the page's language */
  titleKey?: Key;
  /** who sings or plays */
  by: string;
  /** what it is, where certain */
  note: Key | null;
}

export const BUILTIN: readonly BuiltinTrack[] = [
  { id: 'Pclv31cDTTc', sec: 439, title: 'Cuatro Vientos', by: 'Danit', note: null },
  { id: 'fpT5X6HhK3g', sec: 586, title: 'Ábrete Corazón', by: 'Laboratorium Pieśni', note: 'note.concert' },
  { id: 'UvGGetm6pZ4', sec: 237, title: 'Lord Have Mercy', by: 'Lilly Victoria', note: null },
  { id: '-y-5Nba_Nz4', sec: 239, title: 'Исусова молитва', titleKey: 'title.jesus', by: 'Axios', note: 'note.orthodox' },
  { id: 'qD3P7RULGIY', sec: 190, title: 'Pater Noster', by: 'Custodi Nos', note: 'note.chant' },
  { id: '1WgHGd5qfCM', sec: 207, title: 'Psalm 23', by: 'Custodi Nos', note: 'note.chant' },
  { id: 'KGiwGcmBv1Q', sec: 718, title: 'Crux sacra sit mihi lux (33×)', by: 'Harpa Dei', note: 'note.benedict' },
  { id: 'SSpH8Hsx8Q0', sec: 224, title: 'Crux Sacra Sit Mihi Lux', by: 'Ultra Aeternum', note: 'note.benedict' },
  { id: 'TM3ENUzUCaA', sec: 436, title: 'Sat Gur Prasad', by: 'Mirabai Ceiba', note: 'note.mantra' },
  { id: 'kYivP3gedCo', sec: 588, title: 'Ra Ma Da Sa', by: 'Snatam Kaur', note: 'note.mantra' },
  { id: 'c1XCS0g6J4A', sec: 781, title: 'Ong Namo', by: 'Snatam Kaur', note: 'note.mantra' },
];

const IDS = new Set(BUILTIN.map(b => b.id));
export const isBuiltin = (id: string): boolean => IDS.has(id);
export const builtin = (id: string): BuiltinTrack | undefined => BUILTIN.find(b => b.id === id);
