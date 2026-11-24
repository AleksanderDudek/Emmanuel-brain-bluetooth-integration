// The warownie — the strongholds of the series on strongholds (round 16, the founder's own frame).
//
// The founder prays a teaching series on strongholds (2 Cor 10:4-5: "the pulling down of strongholds … bringing into
// captivity every thought"): one stronghold per part — parts 2 and 5–27, 24 in all — each a pattern of lies a person
// lives by, with its fruit, its root and the truth that takes its place. His prayer app carries a full prayer for
// each; here the same 24, in the series' order, are the themed sets of two games:
//   * Każda myśl (mysli): a warownia is a set of the stronghold's lies, each burned and answered by its truth;
//   * Brzemiona (brzemiona): a warownia is a set of the wounds and weights it leaves, given to the Cross.
// This file holds only what both share: the id, the part, the name in four languages, the opening verse, the group a
// chooser shows it under and the care a game owes it. Each game writes its own lies, truths and burdens.
//
// No teacher or series is named (the founder's rule), and nothing here names a spirit: the games take from the series
// the lie and the truth, never its deliverance prayers.

import type { Lang } from '../../i18n';
import type { PassageId } from './scripture';

export type WarowniaId =
  | 'rejection' | 'instability' | 'self-admiration' | 'compulsions' | 'paranoia' | 'antisocial' | 'dependence'
  | 'acting' | 'isolation' | 'humiliation' | 'manipulation' | 'immaturity' | 'pessimism' | 'fears' | 'sexual'
  | 'foolishness' | 'religion' | 'humanism' | 'atheism' | 'racism' | 'greed' | 'lies' | 'pleasures' | 'addictions';

/** The five families a chooser shows them under (a phone can't list 24 at once). */
export type WarowniaGroup = 'unrest' | 'wounds' | 'self' | 'desire' | 'truth';

/**
 * The care a game owes a stronghold (the series' own cautions):
 * - `crisis`: the part touches self-harm or despair — show the help line before playing;
 * - `ocd`: compulsions — never make the burning a ritual; once, then leave it with God, and keep to the treatment;
 * - `medical`: bodily symptoms or fears that may need a doctor or a specialist;
 * - `addiction`: an addiction — prayer goes with help (a group, a therapist), never instead of it.
 */
export type WarowniaCare = 'crisis' | 'ocd' | 'medical' | 'addiction';

export interface Warownia {
  id: WarowniaId;
  /** the part of the series it comes from (2, 5–27): the order of every list */
  part: number;
  group: WarowniaGroup;
  /** the stronghold's name, a noun phrase that fits "Warownia …" / "the stronghold of …" in a title */
  name: Readonly<Record<Lang, string>>;
  /** the verse its part opens with (Jer 17:5 for dependence is not in scripture.ts: its v. 7 stands instead) */
  verse: PassageId;
  care: readonly WarowniaCare[];
}

const W = (
  id: WarowniaId, part: number, group: WarowniaGroup, verse: PassageId, care: readonly WarowniaCare[],
  pl: string, en: string, de: string, sv: string,
): Warownia => ({ id, part, group, verse, care, name: { pl, en, de, sv } });

/** The 24 strongholds in the series' order. */
export const WAROWNIE: readonly Warownia[] = [
  W('rejection', 2, 'wounds', 'isa53.3', [], 'Odrzucenie', 'Rejection', 'Ablehnung', 'Avvisning'),
  W('instability', 5, 'unrest', 'jas1.8', ['crisis'], 'Chwiejność', 'Instability', 'Unbeständigkeit', 'Ostadighet'),
  W('self-admiration', 6, 'self', 'ezk28.17', [], 'Samozachwyt', 'Self-admiration', 'Selbstverliebtheit', 'Självbeundran'),
  W('compulsions', 7, 'unrest', 'lam3.62', ['ocd'], 'Perfekcjonizm i natręctwa', 'Perfectionism and compulsions', 'Perfektionismus und Zwänge', 'Perfektionism och tvång'),
  W('paranoia', 8, 'unrest', 'pro18.11', ['medical'], 'Podejrzliwość', 'Suspicion', 'Argwohn', 'Misstänksamhet'),
  W('antisocial', 9, 'self', 'psa36.2', [], 'Lekceważenie innych', 'Disregard for others', 'Rücksichtslosigkeit', 'Hänsynslöshet'),
  W('dependence', 10, 'self', 'jer17.7', [], 'Zależność od ludzi', 'Dependence on people', 'Abhängigkeit von Menschen', 'Beroende av människor'),
  W('acting', 11, 'self', '2sa13.6', [], 'Aktorstwo', 'Acting', 'Schauspielerei', 'Skådespeleri'),
  W('isolation', 12, 'wounds', 'pro18.1', [], 'Izolacja', 'Isolation', 'Rückzug', 'Isolering'),
  W('humiliation', 13, 'wounds', 'luk1.52', ['crisis'], 'Poniżenie', 'Humiliation', 'Demütigung', 'Förödmjukelse'),
  W('manipulation', 14, 'self', '2co2.11', [], 'Manipulacja', 'Manipulation', 'Manipulation', 'Manipulation'),
  W('immaturity', 15, 'self', '1co14.20', [], 'Niedojrzałość', 'Immaturity', 'Unreife', 'Omognad'),
  W('pessimism', 16, 'wounds', 'isa40.31', [], 'Pesymizm', 'Pessimism', 'Pessimismus', 'Pessimism'),
  W('fears', 17, 'unrest', 'heb2.15', ['medical'], 'Lęk', 'Fear', 'Angst', 'Rädsla'),
  W('sexual', 18, 'desire', 'jer2.21', [], 'Pożądliwość', 'Lust', 'Begierde', 'Lusta'),
  W('foolishness', 19, 'truth', 'psa38.5', [], 'Głupota', 'Foolishness', 'Torheit', 'Dårskap'),
  W('religion', 20, 'truth', 'mrk7.8', [], 'Religijność bez Chrystusa', 'Religion without Christ', 'Religion ohne Christus', 'Religion utan Kristus'),
  W('humanism', 21, 'truth', 'num23.19', [], 'Człowiek zamiast Boga', 'Man in God’s place', 'Der Mensch an Gottes Stelle', 'Människan i Guds ställe'),
  W('atheism', 22, 'truth', 'psa10.4', [], 'Niewiara', 'Unbelief', 'Unglaube', 'Otro'),
  W('racism', 23, 'truth', 'gal3.28', [], 'Uprzedzenia', 'Prejudice', 'Vorurteile', 'Fördomar'),
  W('greed', 24, 'desire', 'col3.5', [], 'Chciwość', 'Greed', 'Habgier', 'Girighet'),
  W('lies', 25, 'truth', 'isa28.17', [], 'Kłamstwo', 'Lies', 'Lüge', 'Lögn'),
  W('pleasures', 26, 'desire', '1co6.12', ['addiction'], 'Martwe upodobania', 'Dead pleasures', 'Leere Vergnügen', 'Tomma nöjen'),
  W('addictions', 27, 'desire', '2ti2.26', ['addiction'], 'Nałogi', 'Addiction', 'Sucht', 'Missbruk'),
];

/** The groups in a chooser's order, with their names. */
export const WAROWNIA_GROUPS: readonly { id: WarowniaGroup; name: Readonly<Record<Lang, string>> }[] = [
  { id: 'unrest', name: { pl: 'Lęk i niepokój', en: 'Fear and unrest', de: 'Angst und Unruhe', sv: 'Rädsla och oro' } },
  { id: 'wounds', name: { pl: 'Rany i wstyd', en: 'Wounds and shame', de: 'Wunden und Scham', sv: 'Sår och skam' } },
  { id: 'self', name: { pl: 'Ja i inni', en: 'Me and others', de: 'Ich und die anderen', sv: 'Jag och andra' } },
  { id: 'desire', name: { pl: 'Pragnienia', en: 'Desires', de: 'Begierden', sv: 'Begär' } },
  { id: 'truth', name: { pl: 'Wiara i prawda', en: 'Faith and truth', de: 'Glaube und Wahrheit', sv: 'Tro och sanning' } },
];

/** The word for the sets themselves, and the series' key verse for a set's opening (the method's John 8:32). */
export const WAROWNIA_WORD: Readonly<Record<Lang, { one: string; many: string }>> = {
  pl: { one: 'Warownia', many: 'Warownie' },
  en: { one: 'Stronghold', many: 'Strongholds' },
  de: { one: 'Festung', many: 'Festungen' },
  sv: { one: 'Fäste', many: 'Fästen' },
};
export const WAROWNIA_KEY_VERSES: readonly PassageId[] = ['2co10.4', '2co10.5', 'jhn8.32'];

const BY_ID: ReadonlyMap<string, Warownia> = new Map(WAROWNIE.map(w => [w.id, w]));

/** The stronghold with this id, or undefined (a saved id from a later version, garbage). */
export const warownia = (id: unknown): Warownia | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);
export const isWarowniaId = (id: unknown): id is WarowniaId => warownia(id) !== undefined;
export const warowniaName = (w: Warownia, l: Lang): string => w.name[l];
export const warownieIn = (g: WarowniaGroup): readonly Warownia[] => WAROWNIE.filter(w => w.group === g);
