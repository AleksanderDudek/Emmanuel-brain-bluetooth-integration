/**
 * Posłaniec's data: the seven churches of Asia on the messenger's road (Revelation 1:11), the cloaks
 * the drachma jar dresses him in, the missions ("Zlecenia", three at a time) and the lines under a
 * block's name.  The words live in the catalog (i18n.ts), in this page's language; a city's letter is
 * named by its reference only (Revelation 2–3), never typed.
 */
import { t } from './i18n';
import { RULES } from './rules';

export type CityId = 'efez' | 'smyrna' | 'pergamon' | 'tiatyra' | 'sardes' | 'filadelfia' | 'laodycea';
export const CITY_IDS: readonly CityId[] = ['efez', 'smyrna', 'pergamon', 'tiatyra', 'sardes', 'filadelfia', 'laodycea'];

/** A city on the road: its name, its name after "to" ("do Smyrny"), its letter's reference. */
export interface City { index: number; id: CityId; name: string; to: string; ref: string }

export const CITIES: readonly City[] = CITY_IDS.map((id, index) => ({
  index, id, name: t(`city.${id}`), to: t(`city.${id}.to`), ref: t(`city.${id}.ref`),
}));

/** The jar's cloaks: milestone (drachmas, all time), colours of the wool and its trim. */
export interface Cloak { index: number; at: number; name: string; wool: string; trim: string }
const CLOAK_LOOK: readonly [string, string][] = [['#a88c64', '#5f4a30'], ['#b8412e', '#e8b04a'], ['#2f4f8f', '#d9c27a'], ['#6b2a6e', '#f0c869']];
export const CLOAKS: readonly Cloak[] = RULES.cloaks.map((at, index) => ({
  index, at, name: t(`cloak.${index as 0 | 1 | 2 | 3}`), wool: CLOAK_LOOK[index][0], trim: CLOAK_LOOK[index][1],
}));

/** What a mission counts, from the session's tallies (sim.ts). */
export type MissionKind = 'slides' | 'heightsSec' | 'coins' | 'jumps' | 'wagons' | 'metres' | 'fires' | 'combo' | 'powers' | 'clean';
export type MissionId = 'slide10' | 'heights20' | 'coins300' | 'jump15' | 'wagon3' | 'km2' | 'fires6' | 'combo50' | 'powers2' | 'clean400' | 'coins600' | 'km4';
export interface Mission { id: MissionId; kind: MissionKind; target: number; name: string }

const mission = (id: MissionId, kind: MissionKind, target: number): Mission => ({ id, kind, target, name: t(`mission.${id}`) });

/**
 * The messenger's errands in the order they open: three at a time, a done one replaced after the
 * session by the next not yet open.  Mostly touch feats; a few for the band.  None counts a stumble.
 */
export const MISSIONS: readonly Mission[] = [
  mission('slide10', 'slides', 10),
  mission('coins300', 'coins', 300),
  mission('heights20', 'heightsSec', 20),
  mission('jump15', 'jumps', 15),
  mission('wagon3', 'wagons', 3),
  mission('fires6', 'fires', 6),
  mission('km2', 'metres', 2000),
  mission('combo50', 'combo', 50),
  mission('powers2', 'powers', 2),
  mission('clean400', 'clean', 400),
  mission('coins600', 'coins', 600),
  mission('km4', 'metres', 4000),
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
