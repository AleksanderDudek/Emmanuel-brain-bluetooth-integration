/**
 * Wzlot's data: the vistas of the land ("Widoki ziemi": four biblical landscapes in two lights),
 * the flight log's missions ("Księga lotów", three at a time), the plumage stages and the lines
 * under a block's name.  Everything a designer may want to tune without touching the rules
 * (sim.ts, meta.ts); the words themselves live in the catalog (i18n.ts), in this page's language.
 */
import { t } from './i18n';
import { RULES } from './rules';

export type Land = 'negev' | 'wadi' | 'jordan' | 'hermon';
export type Light = 'dawn' | 'dusk';
export const LANDS: readonly Land[] = ['negev', 'wadi', 'jordan', 'hermon'];
export const LIGHTS: readonly Light[] = ['dawn', 'dusk'];

/** A vista; `name` reads as a title ("Urwiska Negewu o świcie"). */
export interface Vista { index: number; land: Land; light: Light; name: string }

/** The eight vistas: the dawn four, then the dusk four. */
export const VISTAS: readonly Vista[] = LIGHTS.flatMap((light, li) =>
  LANDS.map((land, i) => ({ index: li * LANDS.length + i, land, light, name: t(`vista.${land}.${light}`) })));

/** What a mission counts, from the session's tallies (sim.ts). */
export type MissionKind = 'chain' | 'thermals' | 'metres' | 'glideHills' | 'altitude' | 'ridges' | 'smooth' | 'soarSec' | 'glideLen' | 'follow';
export type MissionId =
  | 'soar' | 'thermals2' | 'km3' | 'chain5' | 'glide3' | 'high2' | 'ridges3' | 'smooth20' | 'soar15' | 'high3' | 'glide5' | 'chain10' | 'follow' | 'km8';
export interface Mission { id: MissionId; kind: MissionKind; target: number; name: string }

const mission = (id: MissionId, kind: MissionKind, target: number): Mission => ({ id, kind, target, name: t(`mission.${id}`) });

/**
 * The flight log, in the order its pages open: three at a time, a done one replaced after the
 * session by the next not yet open.  Touch feats first, a few for the band; none ever counts a
 * lapse or a catch.
 */
export const MISSIONS: readonly Mission[] = [
  mission('soar', 'chain', 3),
  mission('thermals2', 'thermals', 2),
  mission('km3', 'metres', 3000),
  mission('chain5', 'chain', 5),
  mission('glide3', 'glideHills', 3),
  mission('high2', 'altitude', 100 / RULES.mPerSh),
  mission('ridges3', 'ridges', 3),
  mission('smooth20', 'smooth', 20),
  mission('soar15', 'soarSec', 15),
  mission('high3', 'altitude', 150 / RULES.mPerSh),
  mission('glide5', 'glideLen', 240 / RULES.mPerSh),
  mission('chain10', 'chain', 10),
  mission('follow', 'follow', 1),
  mission('km8', 'metres', 8000),
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

/** The plumage stages (v1 has three); `skill` is what the stage adds. */
export const STAGES: readonly { name: string; skill: string }[] = [
  { name: t('stage.1'), skill: t('stage.1.skill') },
  { name: t('stage.2'), skill: t('stage.2.skill') },
  { name: t('stage.3'), skill: t('stage.3.skill') },
];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  lekcja: [t('tip.lekcja.1'), t('tip.lekcja.2'), t('tip.lekcja.3'), t('tip.lekcja.4'), t('tip.lekcja.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  wzn: [t('tip.wzn.1'), t('tip.wzn.2'), t('tip.wzn.3')],
  stretch: t('tip.stretch'),
  /** after a lapse, while the parent circles back */
  lapse: t('tip.lapse'),
  /** the first-ever Lekcja and Wznoszenie explain themselves */
  firstLekcja: t('tip.firstLekcja'),
  firstWzn: t('tip.firstWzn'),
} as const;
