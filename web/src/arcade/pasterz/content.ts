/**
 * Pasterz's data: the twelve lambs that get a name and a bell when the lost one of a pasture is
 * carried home, the missions (three open at a time) and the lines under a block's name.  The words
 * live in the catalog (i18n.ts), in this page's language.
 */
import { t } from './i18n';

/** A named lamb: its name in this language and the colour of its bell. */
export interface Lamb { index: number; name: string; bell: string }

const BELLS = ['#d9a441', '#c8553d', '#4f7cac', '#6a994e', '#b5838d', '#e07a5f', '#3d5a80', '#9c6644', '#81b29a', '#f2cc8f', '#7b2cbf', '#2a9d8f'];

export const LAMBS: readonly Lamb[] = BELLS.map((bell, index) => ({ index, name: t(`lamb.${index}` as 'lamb.0'), bell }));

/** What a mission counts, from the session's tallies (sim.ts). */
export type MissionKind = 'gathered' | 'lambs' | 'voices' | 'freed' | 'pastures' | 'stars' | 'morning' | 'clean';
export type MissionId = 'gather15' | 'lamb' | 'voice2' | 'free3' | 'pasture2' | 'stars8' | 'morning' | 'gather40' | 'clean';
export interface Mission { id: MissionId; kind: MissionKind; target: number; name: string }

const mission = (id: MissionId, kind: MissionKind, target: number): Mission => ({ id, kind, target, name: t(`mission.${id}`) });

/** The missions in the order they open: touch feats first, a few for the band; none counts a failure. */
export const MISSIONS: readonly Mission[] = [
  mission('gather15', 'gathered', 15),
  mission('lamb', 'lambs', 1),
  mission('free3', 'freed', 3),
  mission('voice2', 'voices', 2),
  mission('pasture2', 'pastures', 2),
  mission('stars8', 'stars', 8),
  mission('morning', 'morning', 1),
  mission('gather40', 'gathered', 40),
  mission('clean', 'clean', 1),
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  call: [t('tip.call.1'), t('tip.call.2'), t('tip.call.3'), t('tip.call.4'), t('tip.call.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  watch: [t('tip.watch.1'), t('tip.watch.2'), t('tip.watch.3')],
  firstCall: t('tip.firstCall'),
  firstWatch: t('tip.firstWatch'),
} as const;
