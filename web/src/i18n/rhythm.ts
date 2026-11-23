/**
 * The texts of the rest's rhythm (src/arcade/kit/rhythm.ts, the lobby's "Rytm" row) and of the breath guide
 * (src/arcade/kit/breathguide.ts, the runner's pacer in rest blocks), in the four languages.  Their own catalog, so
 * the games' big catalog (i18n/arcade.ts) stays the games' own.
 */
import { translator, type Catalog, type Msg } from './index';

const NB = ' ';

const pl = {
  'rhythm.title': 'Rytm',
  'rhythm.focus': 'Skupienie',
  'rhythm.rest': 'Odpoczynek',
  'rhythm.sec': `{n}${NB}s`,
  'rhythm.breaths': { one: `{n}${NB}oddech`, few: `{n}${NB}oddechy`, many: `{n}${NB}oddechów`, other: `{n}${NB}oddechu` },
  'rhythm.breathsSec': `{b} · {s}${NB}s`,
  'rhythm.count': { one: `ok. {n} odpoczynek w sesji`, few: `ok. {n} odpoczynki w sesji`, many: `ok. {n} odpoczynków w sesji`, other: `ok. {n} odpoczynku w sesji` },
  'rhythm.share': `odpoczynek to ok. {pct}${NB}% czasu`,
  'rhythm.default': 'jak zaprojektowano',
  'rhythm.custom': 'Twój rytm',
  'rhythm.reset': 'Przywróć',
  'rhythm.minus': '{name}: mniej',
  'rhythm.plus': '{name}: więcej',
  'rhythm.short': `Odpoczynek krótszy niż 15${NB}s może nie wystarczyć, by sygnał opaski wrócił do spoczynku — wynik bloku będzie mniej pewny.`,
  'rhythm.why': 'Dlaczego są odpoczynki?',
  'rhythm.why1': 'Opaska mierzy, ile tlenu niesie krew w korze przedczołowej. Gdy się skupiasz, przypływ rośnie po kilku sekundach, a opada dopiero po kilkunastu. Odpoczynek pozwala mu wrócić — wtedy kolejne skupienie widać wyraźnie na tle spokoju. Tak porównuje się bloki w badaniach fNIRS.',
  'rhythm.why2': 'Odpoczynek jest też częścią treningu: uczysz się włączać skupienie i odpuszczać je na zawołanie. Ustaw rytm tak, jak Ci służy — dłuższe skupienie to rzadsze przerwy.',
  'rhythm.whyLink': 'Więcej o korze przedczołowej',
  'breath.in': 'Wdech',
  'breath.holdIn': 'Zatrzymaj',
  'breath.out': 'Wydech',
  'breath.holdOut': 'Pauza',
  'breath.of': 'oddech {n} z {of}',
  'breath.label': 'Oddech: {phase}',
} satisfies Record<string, Msg>;

type Key = keyof typeof pl;

const en: Catalog<Key> = {
  'rhythm.title': 'Rhythm',
  'rhythm.focus': 'Focus',
  'rhythm.rest': 'Rest',
  'rhythm.sec': `{n}${NB}s`,
  'rhythm.breaths': { one: `{n}${NB}breath`, other: `{n}${NB}breaths` },
  'rhythm.breathsSec': `{b} · {s}${NB}s`,
  'rhythm.count': { one: 'about {n} rest a session', other: 'about {n} rests a session' },
  'rhythm.share': `rest is about {pct}${NB}% of the time`,
  'rhythm.default': 'as designed',
  'rhythm.custom': 'your rhythm',
  'rhythm.reset': 'Reset',
  'rhythm.minus': '{name}: less',
  'rhythm.plus': '{name}: more',
  'rhythm.short': `A rest under 15${NB}s may not give the band's signal time to settle — the block's result will be less certain.`,
  'rhythm.why': 'Why are there rests?',
  'rhythm.why1': 'The band measures how much oxygen the blood carries in your prefrontal cortex. When you focus, the flow rises after a few seconds and settles only after ten or more. A rest lets it return, so the next focus stands out clearly against calm. That is how fNIRS studies compare blocks.',
  'rhythm.why2': 'Rest is also part of the training: you learn to switch focus on and let it go at will. Set the rhythm that serves you — longer focus means fewer breaks.',
  'rhythm.whyLink': 'More about the prefrontal cortex',
  'breath.in': 'Breathe in',
  'breath.holdIn': 'Hold',
  'breath.out': 'Breathe out',
  'breath.holdOut': 'Pause',
  'breath.of': 'breath {n} of {of}',
  'breath.label': 'Breath: {phase}',
};

const de: Catalog<Key> = {
  'rhythm.title': 'Rhythmus',
  'rhythm.focus': 'Fokus',
  'rhythm.rest': 'Ruhe',
  'rhythm.sec': `{n}${NB}s`,
  'rhythm.breaths': { one: `{n}${NB}Atemzug`, other: `{n}${NB}Atemzüge` },
  'rhythm.breathsSec': `{b} · {s}${NB}s`,
  'rhythm.count': { one: 'etwa {n} Pause pro Sitzung', other: 'etwa {n} Pausen pro Sitzung' },
  'rhythm.share': `Ruhe ist etwa {pct}${NB}% der Zeit`,
  'rhythm.default': 'wie vorgesehen',
  'rhythm.custom': 'dein Rhythmus',
  'rhythm.reset': 'Zurücksetzen',
  'rhythm.minus': '{name}: weniger',
  'rhythm.plus': '{name}: mehr',
  'rhythm.short': `Eine Ruhe unter 15${NB}s reicht dem Signal des Stirnbands vielleicht nicht, um zur Ruhe zu kommen – das Ergebnis des Blocks ist dann weniger sicher.`,
  'rhythm.why': 'Warum gibt es Pausen?',
  'rhythm.why1': 'Das Stirnband misst, wie viel Sauerstoff das Blut im präfrontalen Kortex trägt. Wenn du dich konzentrierst, steigt der Zustrom nach einigen Sekunden und sinkt erst nach zehn oder mehr wieder. Die Ruhe lässt ihn zurückkehren – so hebt sich der nächste Fokus deutlich von der Ruhe ab. So vergleichen fNIRS-Studien Blöcke.',
  'rhythm.why2': 'Die Ruhe gehört auch zum Training: Du lernst, den Fokus auf Abruf einzuschalten und wieder loszulassen. Stell den Rhythmus so ein, wie er dir dient – längerer Fokus heißt seltenere Pausen.',
  'rhythm.whyLink': 'Mehr über den präfrontalen Kortex',
  'breath.in': 'Einatmen',
  'breath.holdIn': 'Halten',
  'breath.out': 'Ausatmen',
  'breath.holdOut': 'Pause',
  'breath.of': 'Atemzug {n} von {of}',
  'breath.label': 'Atem: {phase}',
};

const sv: Catalog<Key> = {
  'rhythm.title': 'Rytm',
  'rhythm.focus': 'Fokus',
  'rhythm.rest': 'Vila',
  'rhythm.sec': `{n}${NB}s`,
  'rhythm.breaths': { one: `{n}${NB}andetag`, other: `{n}${NB}andetag` },
  'rhythm.breathsSec': `{b} · {s}${NB}s`,
  'rhythm.count': { one: 'omkring {n} vila per pass', other: 'omkring {n} vilor per pass' },
  'rhythm.share': `vila är omkring {pct}${NB}% av tiden`,
  'rhythm.default': 'som tänkt',
  'rhythm.custom': 'din rytm',
  'rhythm.reset': 'Återställ',
  'rhythm.minus': '{name}: mindre',
  'rhythm.plus': '{name}: mer',
  'rhythm.short': `En vila kortare än 15${NB}s räcker kanske inte för att pannbandets signal ska hinna lugna sig – blockets resultat blir mindre säkert.`,
  'rhythm.why': 'Varför finns det vilor?',
  'rhythm.why1': 'Pannbandet mäter hur mycket syre blodet bär i din prefrontala bark. När du fokuserar ökar flödet efter några sekunder och sjunker först efter tio eller fler. Vilan låter det återvända, så att nästa fokus syns tydligt mot lugnet. Så jämför fNIRS-studier block.',
  'rhythm.why2': 'Vilan är också en del av träningen: du lär dig att slå på fokus och släppa det när du vill. Ställ in den rytm som hjälper dig – längre fokus betyder färre pauser.',
  'rhythm.whyLink': 'Mer om den prefrontala barken',
  'breath.in': 'Andas in',
  'breath.holdIn': 'Håll',
  'breath.out': 'Andas ut',
  'breath.holdOut': 'Paus',
  'breath.of': 'andetag {n} av {of}',
  'breath.label': 'Andning: {phase}',
};

export const CATALOGS = { pl, en, de, sv };
export const t = translator<Key>(CATALOGS);
export type RhythmKey = Key;
