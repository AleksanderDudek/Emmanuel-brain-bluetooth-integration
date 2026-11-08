/**
 * Texts of the author's support and contact (src/ui/support.ts): the ribbon at the top, the
 * window at the end of every tab with its thought for today, the coffee and the contact links.
 * `{site}` is the coffee jar's domain, which follows the language (buycoffee.to for Polish,
 * buymeacoffee.com for the rest), or the name of a social network.
 */
import { translator, type Catalog, type Msg } from './index';

const pl = {
  'support.ribbon': 'Emmanuel jest darmowy · postaw autorowi kawę',
  'support.ribbonShort': 'Postaw autorowi kawę',
  'support.rubric': 'Myśl na dziś',
  'support.title': 'Pomóż Emmanuelowi trwać',
  'support.line': 'Emmanuel jest darmowy, bez reklam i śledzenia. Jeśli Ci pomaga, możesz postawić autorowi kawę.',
  'support.button': 'Postaw kawę',
  'support.aria': 'Postaw autorowi kawę – otwiera {site} w nowej karcie',
  'support.note': '{site} · otwiera się w nowej karcie',
  'support.tip1': 'Zanim zaczniesz, weź trzy spokojne oddechy. Ciało, które już siedzi cicho, daje czystszy sygnał.',
  'support.tip2': 'Kilka minut każdego dnia daje więcej niż godzina raz w tygodniu.',
  'support.tip3': 'Myśli przyjdą. Zauważ je bez złości i wróć – jak do domu.',
  'support.tip4': 'Ta sama pora, to samo miejsce: nawyk najlepiej rośnie w tej samej glebie.',
  'support.tip5': 'Rozluźnij czoło i szczękę. Napięte mięśnie mogą zakłócać odczyt opaski.',
  'support.tip6': 'Słabsza sesja to też trening. Liczy się każdy powrót, nie wynik.',
  'support.tip7': 'Po treningu zostań chwilę w ciszy, zanim sięgniesz po telefon.',
  'support.tip8': 'Uwaga rośnie od powtórzeń, nie od zrywów – jak każda umiejętność.',
  'support.tip9': 'Siedź prosto, ale bez sztywności – jak w oczekiwaniu na kogoś bliskiego.',
  'support.tip10': 'Cisza nie jest pustką. To miejsce, w którym można słuchać.',
  'contact.title': 'Napisz do autora',
  'contact.line': 'Aleksander Dudek. Pomysł, błąd albo dobre słowo – chętnie przeczytam.',
  'contact.aria': '{site}: Aleksander Dudek (otwiera nową kartę)',
} satisfies Record<string, Msg>;

type Key = keyof typeof pl;

const en: Catalog<Key> = {
  'support.ribbon': 'Emmanuel is free · buy the author a coffee',
  'support.ribbonShort': 'Buy the author a coffee',
  'support.rubric': 'A thought for today',
  'support.title': 'Help keep Emmanuel going',
  'support.line': 'Emmanuel is free, with no ads and no tracking. If it helps you, you can buy its author a coffee.',
  'support.button': 'Buy a coffee',
  'support.aria': 'Buy the author a coffee — opens {site} in a new tab',
  'support.note': '{site} · opens in a new tab',
  'support.tip1': 'Before you begin, take three calm breaths. A body that is already still gives a cleaner signal.',
  'support.tip2': 'A few minutes every day do more than an hour once a week.',
  'support.tip3': 'Thoughts will come. Notice them without annoyance and come back — as you would come home.',
  'support.tip4': 'Same time, same place: a habit grows best in the same soil.',
  'support.tip5': 'Soften your forehead and jaw. Tense muscles can blur the band’s reading.',
  'support.tip6': 'A weaker session is training too. What counts is each return, not the score.',
  'support.tip7': 'After training, stay a moment in the quiet before you reach for your phone.',
  'support.tip8': 'Attention grows by repetition, not by bursts — like any skill.',
  'support.tip9': 'Sit upright but not stiff — as if you were waiting for someone dear.',
  'support.tip10': 'Silence is not emptiness. It is a place where you can listen.',
  'contact.title': 'Write to the author',
  'contact.line': 'Aleksander Dudek. An idea, a bug or a kind word — I’ll be glad to read it.',
  'contact.aria': '{site}: Aleksander Dudek (opens a new tab)',
};

const de: Catalog<Key> = {
  'support.ribbon': 'Emmanuel ist kostenlos · spendiere dem Autor einen Kaffee',
  'support.ribbonShort': 'Spendiere dem Autor einen Kaffee',
  'support.rubric': 'Ein Gedanke für heute',
  'support.title': 'Hilf mit, dass Emmanuel weitergeht',
  'support.line': 'Emmanuel ist kostenlos, ohne Werbung und ohne Tracking. Wenn es dir hilft, kannst du dem Autor einen Kaffee spendieren.',
  'support.button': 'Einen Kaffee spendieren',
  'support.aria': 'Dem Autor einen Kaffee spendieren – öffnet {site} in einem neuen Tab',
  'support.note': '{site} · öffnet sich in einem neuen Tab',
  'support.tip1': 'Bevor du beginnst, atme dreimal ruhig durch. Ein Körper, der schon still ist, gibt ein saubereres Signal.',
  'support.tip2': 'Ein paar Minuten jeden Tag bringen mehr als eine Stunde einmal pro Woche.',
  'support.tip3': 'Gedanken werden kommen. Bemerke sie ohne Ärger und kehre zurück – wie nach Hause.',
  'support.tip4': 'Gleiche Zeit, gleicher Ort: Eine Gewohnheit wächst am besten im selben Boden.',
  'support.tip5': 'Entspanne Stirn und Kiefer. Angespannte Muskeln können die Messung des Stirnbands stören.',
  'support.tip6': 'Eine schwächere Sitzung ist auch Training. Es zählt jede Rückkehr, nicht das Ergebnis.',
  'support.tip7': 'Bleib nach dem Training einen Moment in der Stille, bevor du zum Handy greifst.',
  'support.tip8': 'Aufmerksamkeit wächst durch Wiederholung, nicht durch Kraftakte – wie jede Fähigkeit.',
  'support.tip9': 'Sitz aufrecht, aber nicht steif – als würdest du auf einen lieben Menschen warten.',
  'support.tip10': 'Stille ist nicht Leere. Sie ist ein Ort, an dem man hören kann.',
  'contact.title': 'Schreib dem Autor',
  'contact.line': 'Aleksander Dudek. Eine Idee, ein Fehler oder ein gutes Wort – ich lese es gern.',
  'contact.aria': '{site}: Aleksander Dudek (öffnet einen neuen Tab)',
};

const sv: Catalog<Key> = {
  'support.ribbon': 'Emmanuel är gratis · bjud skaparen på en kaffe',
  'support.ribbonShort': 'Bjud skaparen på en kaffe',
  'support.rubric': 'En tanke för i dag',
  'support.title': 'Hjälp Emmanuel att leva vidare',
  'support.line': 'Emmanuel är gratis, utan reklam och utan spårning. Om appen hjälper dig kan du bjuda skaparen på en kaffe.',
  'support.button': 'Bjud på en kaffe',
  'support.aria': 'Bjud skaparen på en kaffe – öppnar {site} i en ny flik',
  'support.note': '{site} · öppnas i en ny flik',
  'support.tip1': 'Innan du börjar: ta tre lugna andetag. En kropp som redan är stilla ger en renare signal.',
  'support.tip2': 'Några minuter varje dag ger mer än en timme en gång i veckan.',
  'support.tip3': 'Tankar kommer. Lägg märke till dem utan irritation och vänd tillbaka – som när man kommer hem.',
  'support.tip4': 'Samma tid, samma plats: en vana växer bäst i samma jord.',
  'support.tip5': 'Slappna av i pannan och käken. Spända muskler kan störa pannbandets mätning.',
  'support.tip6': 'Ett svagare pass är också träning. Det som räknas är varje återvändande, inte resultatet.',
  'support.tip7': 'Stanna en stund i tystnaden efter träningen, innan du tar fram telefonen.',
  'support.tip8': 'Uppmärksamhet växer genom upprepning, inte genom ryck – som varje färdighet.',
  'support.tip9': 'Sitt rak men inte stel – som om du väntade på någon du håller av.',
  'support.tip10': 'Tystnad är inte tomhet. Den är en plats där man kan lyssna.',
  'contact.title': 'Skriv till skaparen',
  'contact.line': 'Aleksander Dudek. En idé, en bugg eller ett vänligt ord – jag läser gärna.',
  'contact.aria': '{site}: Aleksander Dudek (öppnas i en ny flik)',
};

export const CATALOGS = { pl, en, de, sv };
export const t = translator<Key>(CATALOGS);
export type SupportKey = Key;
