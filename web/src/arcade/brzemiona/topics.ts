/**
 * Brzemiona's ready suggestions for "Moje brzemiona" (round 16, the founder: "Chcę też móc zdefiniować listę takich
 * tematów, które chcę oddać… (Może znowu warownie?)"): topics the player adds to their own list with a tap, on two
 * shelves —
 *
 *   Codzienne   ten themes of ordinary life (work, money, health, family, relationships, the past, fear of tomorrow,
 *               tiredness, decisions, loss), each with three or four short topics
 *   Warownie    the 24 strongholds of the series (kit/warownie.ts), each a set of three to five burdens taken from
 *               its prayer: the wounds it names ("Ojcze, ulecz…") and the people it forgives ("Przebaczam tym,
 *               którzy…") — the series' own method says "noszę w tych dziedzinach rany; przynoszę je teraz Tobie" and
 *               "przebaczam… oddaję ich Tobie", which is what this way of the game does at the Cross
 *
 * A topic is a nominative noun phrase of at most 32 characters (TOPIC_MAX), so the address takes it as it is after a
 * colon ("Panie Jezu, oddaję Ci: rana odrzucenia."), never declined.  The games take from the series the wounds and
 * the people to forgive — never its deliverance language (no spirits, no cursing, no binding), never the teacher's
 * name.  Gentle words, never clinical; Polish first-person forms that would need a gender are avoided.  The care a
 * stronghold is owed (kit/warownie.ts `care`) is shown with its set in the card (i18n `care.<flag>`).
 */
import { lang, type Lang } from '../../i18n';
import { WAROWNIE, type WarowniaId } from '../kit/warownie';

type ByLang<T> = Readonly<Record<Lang, T>>;

/** A theme of ordinary life: its name and its topics in each language. */
export interface Theme { id: string; name: ByLang<string>; topics: ByLang<readonly string[]> }

const T = (id: string, name: ByLang<string>, topics: ByLang<readonly string[]>): Theme => ({ id, name, topics });

/** Codzienne: the themes of ordinary life, in the card's order. */
export const DAILY: readonly Theme[] = [
  T('work', { pl: 'Praca', en: 'Work', de: 'Arbeit', sv: 'Arbete' }, {
    pl: ['praca', 'szef', 'termin, który mnie goni', 'brak pracy'],
    en: ['work', 'my boss', 'a deadline chasing me', 'no work'],
    de: ['die Arbeit', 'Druck bei der Arbeit', 'eine Frist, die mich jagt', 'keine Arbeit'],
    sv: ['arbetet', 'min chef', 'en deadline som jagar mig', 'inget arbete'],
  }),
  T('money', { pl: 'Pieniądze', en: 'Money', de: 'Geld', sv: 'Pengar' }, {
    pl: ['pieniądze', 'długi', 'rachunki', 'lęk o utrzymanie'],
    en: ['money', 'debts', 'bills', 'worry about making ends meet'],
    de: ['Geld', 'Schulden', 'Rechnungen', 'die Sorge ums Auskommen'],
    sv: ['pengar', 'skulder', 'räkningar', 'oron att få det att gå ihop'],
  }),
  T('health', { pl: 'Zdrowie', en: 'Health', de: 'Gesundheit', sv: 'Hälsa' }, {
    pl: ['moje zdrowie', 'zdrowie mamy', 'badania, które mnie czekają', 'ból'],
    en: ['my health', 'my mother’s health', 'tests that are coming up', 'pain'],
    de: ['meine Gesundheit', 'die Gesundheit meiner Mutter', 'Untersuchungen, die anstehen', 'Schmerzen'],
    sv: ['min hälsa', 'mammas hälsa', 'undersökningar som väntar', 'smärta'],
  }),
  T('family', { pl: 'Rodzina', en: 'Family', de: 'Familie', sv: 'Familj' }, {
    pl: ['rodzina', 'moje dzieci', 'moje małżeństwo', 'rodzice'],
    en: ['my family', 'my children', 'my marriage', 'my parents'],
    de: ['meine Familie', 'meine Kinder', 'meine Ehe', 'meine Eltern'],
    sv: ['min familj', 'mina barn', 'mitt äktenskap', 'mina föräldrar'],
  }),
  T('relations', { pl: 'Relacje', en: 'Relationships', de: 'Beziehungen', sv: 'Relationer' }, {
    pl: ['relacja, która boli', 'spór z bliską osobą', 'rozmowa, która mnie czeka', 'samotność'],
    en: ['a relationship that hurts', 'a quarrel with someone close', 'a conversation ahead of me', 'loneliness'],
    de: ['eine Beziehung, die wehtut', 'Streit mit einem nahen Menschen', 'ein Gespräch, das ansteht', 'Einsamkeit'],
    sv: ['en relation som gör ont', 'en konflikt med någon nära', 'ett samtal som väntar', 'ensamhet'],
  }),
  T('past', { pl: 'Przeszłość', en: 'The past', de: 'Vergangenheit', sv: 'Det som varit' }, {
    pl: ['przeszłość', 'dawna rana', 'to, czego żałuję', 'wspomnienie, które wraca'],
    en: ['the past', 'an old wound', 'what I regret', 'a memory that keeps coming back'],
    de: ['die Vergangenheit', 'eine alte Wunde', 'was ich bereue', 'eine Erinnerung, die wiederkehrt'],
    sv: ['det som varit', 'ett gammalt sår', 'det jag ångrar', 'ett minne som kommer tillbaka'],
  }),
  T('tomorrow', { pl: 'Lęk o jutro', en: 'Fear of tomorrow', de: 'Angst vor morgen', sv: 'Oro för morgondagen' }, {
    pl: ['lęk o jutro', 'niepewność', 'przyszłość moich dzieci', 'to, czego nie mogę zmienić'],
    en: ['fear of tomorrow', 'uncertainty', 'my children’s future', 'what I cannot change'],
    de: ['die Angst vor morgen', 'Ungewissheit', 'die Zukunft meiner Kinder', 'was ich nicht ändern kann'],
    sv: ['oron för morgondagen', 'ovisshet', 'mina barns framtid', 'det jag inte kan ändra'],
  }),
  T('tired', { pl: 'Zmęczenie', en: 'Tiredness', de: 'Müdigkeit', sv: 'Trötthet' }, {
    pl: ['zmęczenie', 'brak snu', 'za dużo na mojej głowie', 'wypalenie'],
    en: ['tiredness', 'too little sleep', 'too much on my mind', 'burnout'],
    de: ['Müdigkeit', 'zu wenig Schlaf', 'zu viel im Kopf', 'Erschöpfung'],
    sv: ['trötthet', 'för lite sömn', 'för mycket i huvudet', 'utbrändhet'],
  }),
  T('decisions', { pl: 'Decyzje', en: 'Decisions', de: 'Entscheidungen', sv: 'Beslut' }, {
    pl: ['decyzja przede mną', 'wybór, którego się boję', 'zmiana, która nadchodzi'],
    en: ['a decision before me', 'a choice I am afraid of', 'a change that is coming'],
    de: ['eine Entscheidung vor mir', 'eine Wahl, die mir Angst macht', 'eine Veränderung, die kommt'],
    sv: ['ett beslut framför mig', 'ett val som skrämmer mig', 'en förändring som kommer'],
  }),
  T('loss', { pl: 'Strata', en: 'Loss', de: 'Verlust', sv: 'Förlust' }, {
    pl: ['strata', 'żałoba', 'rozstanie', 'to, co się skończyło'],
    en: ['loss', 'grief', 'a breakup', 'what has come to an end'],
    de: ['ein Verlust', 'Trauer', 'eine Trennung', 'was zu Ende gegangen ist'],
    sv: ['en förlust', 'sorg', 'ett uppbrott', 'det som tagit slut'],
  }),
];

/**
 * Warownie: each stronghold's burdens, from its prayer — first the wounds it asks to be healed, then the people it
 * forgives (the series' own words where they fit 32 characters, else the nearest short form).
 */
export const WAROWNIA_TOPICS: Readonly<Record<WarowniaId, ByLang<readonly string[]>>> = {
  rejection: {
    pl: ['rana odrzucenia', 'miłość, której mi nie okazano', 'krytyka zamiast pochwały', 'ci, którzy mnie odrzucili', 'ci, którzy mnie zdradzili'],
    en: ['the wound of rejection', 'love that was not shown me', 'criticism instead of praise', 'those who rejected me', 'those who betrayed me'],
    de: ['die Wunde der Ablehnung', 'Liebe, die mir fehlte', 'Kritik statt Lob', 'die, die mich abgelehnt haben', 'die, die mich verraten haben'],
    sv: ['såret av avvisning', 'kärlek jag aldrig fick', 'kritik i stället för beröm', 'de som avvisade mig', 'de som svek mig'],
  },
  instability: {
    pl: ['rany, które są pod spodem', 'pustka, która nie mija', 'lęk przed opuszczeniem', 'ci, którzy mnie zostawili', 'świat, który nie był bezpieczny'],
    en: ['the wounds underneath', 'an emptiness that won’t pass', 'the fear of being left', 'those who left me', 'a world that wasn’t safe'],
    de: ['die Wunden darunter', 'eine Leere, die nicht vergeht', 'die Angst, verlassen zu werden', 'die, die mich verlassen haben', 'eine Welt, die nicht sicher war'],
    sv: ['såren därunder', 'en tomhet som inte går över', 'rädslan att bli lämnad', 'de som lämnade mig', 'en värld som inte var trygg'],
  },
  'self-admiration': {
    pl: ['stara rana pod pychą', 'głód podziwu', 'ci, którzy mnie zranili', 'ci, których podziwu szukam'],
    en: ['an old wound under the pride', 'the hunger to be admired', 'those who wounded me', 'those whose praise I seek'],
    de: ['eine alte Wunde unter dem Stolz', 'der Hunger nach Bewunderung', 'die, die mich verletzt haben', 'die, deren Lob ich suche'],
    sv: ['ett gammalt sår under stoltheten', 'hungern efter beundran', 'de som sårade mig', 'de vars beröm jag söker'],
  },
  compulsions: {
    pl: ['lęk przed każdym błędem', 'wymagania nie do spełnienia', 'potrzeba kontroli', 'ci, którzy żądali doskonałości'],
    en: ['the fear of every mistake', 'demands I could never meet', 'the need for control', 'those who demanded perfection'],
    de: ['die Angst vor jedem Fehler', 'Ansprüche, die keiner erfüllt', 'das Bedürfnis nach Kontrolle', 'die, die Perfektion verlangten'],
    sv: ['rädslan för varje misstag', 'krav som ingen kan uppfylla', 'behovet av kontroll', 'de som krävde perfektion'],
  },
  paranoia: {
    pl: ['rana po zdradzie', 'wyśmianie i oszustwo', 'urazy, które w sobie noszę', 'ci, którzy mnie skrzywdzili'],
    en: ['the wound of betrayal', 'mockery and deceit', 'the grudges I carry', 'those who hurt me'],
    de: ['die Wunde des Verrats', 'Spott und Betrug', 'der Groll, den ich trage', 'die, die mir wehgetan haben'],
    sv: ['såret efter svek', 'hån och bedrägeri', 'agget jag bär på', 'de som skadade mig'],
  },
  antisocial: {
    pl: ['to, co pękło we mnie w młodości', 'zły przykład z domu', 'ci, którzy uczyli mnie twardości'],
    en: ['what broke in me in my youth', 'a bad example at home', 'those who taught me to be hard'],
    de: ['was in meiner Jugend zerbrach', 'ein schlechtes Vorbild zu Hause', 'die, die mich Härte lehrten'],
    sv: ['det som brast i min ungdom', 'ett dåligt exempel hemma', 'de som lärde mig att bli hård'],
  },
  dependence: {
    pl: ['lęk przed samotnością', 'gniew, który połykam', 'ci, którzy mnie kontrolowali', 'ci, których opieki zabrakło'],
    en: ['the fear of being alone', 'the anger I swallow', 'those who controlled me', 'those who left me without care'],
    de: ['die Angst vor dem Alleinsein', 'der Zorn, den ich schlucke', 'die, die mich kontrollierten', 'die, deren Fürsorge fehlte'],
    sv: ['rädslan att vara ensam', 'ilskan jag sväljer', 'de som kontrollerade mig', 'de som lämnade mig utan omsorg'],
  },
  acting: {
    pl: ['miejsca, w których mnie pomijano', 'lęk, że ktoś mnie naprawdę pozna', 'ci, którzy mnie nie zauważali', 'miłość, którą trzeba było zdobyć'],
    en: ['the times I was overlooked', 'the fear of being truly known', 'those who overlooked me', 'love I had to win'],
    de: ['wo man mich übersah', 'die Angst, erkannt zu werden', 'die, die mich übersahen', 'Liebe, um die ich spielen musste'],
    sv: ['när jag blev förbisedd', 'rädslan att bli verkligt känd', 'de som förbisåg mig', 'kärlek jag fick spela till mig'],
  },
  isolation: {
    pl: ['rany, które mnie zamknęły', 'lęk przed zranieniem', 'ci, którzy zranili mnie z bliska', 'ci, których przy mnie nie było'],
    en: ['the wounds that closed me in', 'the fear of being hurt', 'those who hurt me from close up', 'those who were never there'],
    de: ['Wunden, die mich verschlossen', 'die Angst, verletzt zu werden', 'Nahe, die mich verletzt haben', 'die, die nie für mich da waren'],
    sv: ['såren som stängde in mig', 'rädslan att bli sårad', 'de nära som sårade mig', 'de som aldrig fanns där'],
  },
  humiliation: {
    pl: ['chwile, gdy mnie wyśmiewano', 'wstyd, który mi zadano', 'dawne upokorzenia', 'ci, którzy mnie poniżali'],
    en: ['the times I was mocked', 'the shame put on me', 'old humiliations', 'those who humiliated me'],
    de: ['als man mich verspottete', 'die Scham, die man mir auflud', 'alte Demütigungen', 'die, die mich gedemütigt haben'],
    sv: ['när jag blev hånad', 'skammen som lades på mig', 'gamla förödmjukelser', 'de som förödmjukade mig'],
  },
  manipulation: {
    pl: ['miłość zdobywana naciskiem', 'lęk, że nikt o mnie nie zadba', 'ci, którzy mną sterowali'],
    en: ['love won by pressure', 'the fear no one will care for me', 'those who steered me'],
    de: ['Liebe, durch Druck erkämpft', 'die Angst, zu kurz zu kommen', 'die, die mich gesteuert haben'],
    sv: ['kärlek vunnen genom tryck', 'rädslan att bli utan', 'de som styrde mig'],
  },
  immaturity: {
    pl: ['braki z dzieciństwa', 'niskie poczucie wartości', 'kompleksy, które noszę', 'ci, którzy mi nie pomogli rosnąć'],
    en: ['what I lacked as a child', 'low self-worth', 'the complexes I carry', 'those who didn’t help me grow'],
    de: ['was mir als Kind fehlte', 'ein geringes Selbstwertgefühl', 'die Komplexe, die ich trage', 'wer mir nicht half zu wachsen'],
    sv: ['det jag saknade som barn', 'låg självkänsla', 'komplexen jag bär på', 'de som inte hjälpte mig växa'],
  },
  pessimism: {
    pl: ['zawiedzione nadzieje', 'zamartwianie się', 'oczekiwanie najgorszego', 'ci, którzy zgasili moją nadzieję'],
    en: ['disappointed hopes', 'worrying', 'expecting the worst', 'those who crushed my hopes'],
    de: ['enttäuschte Hoffnungen', 'das ständige Sorgen', 'das Schlimmste erwarten', 'die, die meine Hoffnung brachen'],
    sv: ['svikna förhoppningar', 'oron som springer före mig', 'att vänta sig det värsta', 'de som krossade mitt hopp'],
  },
  fears: {
    pl: ['chwile, które mnie przeraziły', 'lęk o jutro', 'lęk przed chorobą', 'lęk przed ludźmi', 'ci, którzy mnie straszyli'],
    en: ['moments that frightened me', 'fear of tomorrow', 'the fear of illness', 'the fear of people', 'those who frightened me'],
    de: ['Momente, die mich erschreckten', 'die Angst vor morgen', 'die Angst vor Krankheit', 'die Angst vor Menschen', 'die, die mir Angst machten'],
    sv: ['stunder som skrämde mig', 'oron för morgondagen', 'rädslan för sjukdom', 'rädslan för människor', 'de som skrämde mig'],
  },
  sexual: {
    pl: ['rany w sferze intymnej', 'to, co ukrywam w ciemności', 'ci, którzy mnie zranili', 'ci, którzy mnie zwiedli'],
    en: ['wounds in my intimate life', 'what I hide in the dark', 'those who wounded me', 'those who led me astray'],
    de: ['Wunden in meiner Intimität', 'was ich im Dunkeln verberge', 'die, die mich verletzt haben', 'die, die mich verführten'],
    sv: ['sår i mitt intima liv', 'det jag gömmer i mörkret', 'de som sårade mig', 'de som förde mig vilse'],
  },
  foolishness: {
    pl: ['wyśmiana niewiedza', 'wstyd, że czegoś nie wiem', 'ci, którzy mnie zmylili', 'ci, którzy mnie źle uczyli'],
    en: ['being mocked for not knowing', 'the shame of not knowing', 'those who misled me', 'those who taught me wrongly'],
    de: ['verspottetes Nichtwissen', 'die Scham, etwas nicht zu wissen', 'die, die mich irreführten', 'die, die mich Falsches lehrten'],
    sv: ['att bli hånad för att inte veta', 'skammen över att inte veta', 'de som vilseledde mig', 'de som lärde mig fel'],
  },
  religion: {
    pl: ['rany z miejsc religijnych', 'religia lęku i przepisów', 'obłuda, która mnie zraniła', 'ci, którzy uczyli mnie lęku'],
    en: ['wounds from religious places', 'a religion of fear and rules', 'hypocrisy that hurt me', 'those who taught me fear'],
    de: ['Wunden aus frommen Kreisen', 'Religion aus Angst und Regeln', 'Heuchelei, die mich verletzte', 'die, die mich Angst lehrten'],
    sv: ['sår från religiösa sammanhang', 'en religion av rädsla och regler', 'hyckleri som sårade mig', 'de som lärde mig rädsla'],
  },
  humanism: {
    pl: ['lęk przed ludźmi', 'głód ludzkiej akceptacji', 'ci, pod których zdaniem żyję'],
    en: ['the fear of people', 'the hunger for approval', 'those whose opinion I live under'],
    de: ['die Angst vor Menschen', 'der Hunger nach Anerkennung', 'die, unter deren Urteil ich lebe'],
    sv: ['rädslan för människor', 'hungern efter godkännande', 'de vars åsikt jag lever under'],
  },
  atheism: {
    pl: ['rozczarowanie wierzącymi', 'zamknięte serce', 'rany zadane w imię Boga', 'ci, którzy ośmieszali wiarę'],
    en: ['disappointment with believers', 'a closed heart', 'wounds dealt in God’s name', 'those who mocked faith'],
    de: ['Enttäuschung über Gläubige', 'ein verschlossenes Herz', 'Wunden im Namen Gottes', 'die, die den Glauben verlachten'],
    sv: ['besvikelsen på troende', 'ett stängt hjärta', 'sår i Guds namn', 'de som hånade tron'],
  },
  racism: {
    pl: ['rany od ludzi z innej grupy', 'ci, którzy mnie skrzywdzili', 'ci, którzy uczyli mnie pogardy'],
    en: ['wounds from another group', 'those who hurt me', 'those who taught me contempt'],
    de: ['Wunden durch eine andere Gruppe', 'die, die mir wehgetan haben', 'die, die mich Verachtung lehrten'],
    sv: ['sår från en annan grupp', 'de som skadade mig', 'de som lärde mig förakt'],
  },
  greed: {
    pl: ['pamięć niedostatku', 'wstyd biedy', 'lęk, że nie wystarczy', 'ci, którzy mi coś odebrali'],
    en: ['the memory of lack', 'the shame of poverty', 'the fear there won’t be enough', 'those who took from me'],
    de: ['die Erinnerung an Mangel', 'die Scham der Armut', 'die Angst, es reicht nicht', 'die, die mir etwas nahmen'],
    sv: ['minnet av brist', 'skammen över fattigdom', 'rädslan att det inte räcker', 'de som tog från mig'],
  },
  lies: {
    pl: ['rany pod fałszywym przekonaniem', 'lęk przed prawdą', 'ci, którzy nauczyli mnie kłamstw'],
    en: ['wounds under false beliefs', 'the fear of the truth', 'those who taught me these lies'],
    de: ['Wunden hinter Irrtümern', 'die Angst vor der Wahrheit', 'die, die mich Lügen lehrten'],
    sv: ['sår under falska övertygelser', 'rädslan för sanningen', 'de som lärde mig lögnerna'],
  },
  pleasures: {
    pl: ['nuda, przed którą uciekam', 'samotność, przed którą uciekam', 'ból, przed którym uciekam', 'ci, którzy mnie w to wciągnęli'],
    en: ['the boredom I run from', 'the loneliness I run from', 'the pain I run from', 'those who drew me in'],
    de: ['Langeweile, vor der ich fliehe', 'Einsamkeit, vor der ich fliehe', 'Schmerz, vor dem ich fliehe', 'die, die mich hineinzogen'],
    sv: ['tristessen jag flyr från', 'ensamheten jag flyr från', 'smärtan jag flyr från', 'de som drog in mig'],
  },
  addictions: {
    pl: ['rany pod moim nałogiem', 'ból, który próbuję znieczulić', 'ci, którzy mnie wciągnęli', 'ci, których zranił mój nałóg'],
    en: ['the wounds under my addiction', 'the pain I try to numb', 'those who drew me in', 'those my addiction has hurt'],
    de: ['Wunden unter meiner Sucht', 'Schmerz, den ich betäube', 'die, die mich hineinzogen', 'wen meine Sucht verletzt hat'],
    sv: ['såren under mitt missbruk', 'smärtan jag försöker döva', 'de som drog in mig', 'de som mitt missbruk sårat'],
  },
};

/** A theme's topics in this page load's language (or another). */
export const themeTopics = (th: Theme, l: Lang = lang): readonly string[] => th.topics[l];

/** A stronghold's burdens in this page load's language (or another). */
export const warowniaTopics = (id: WarowniaId, l: Lang = lang): readonly string[] => WAROWNIA_TOPICS[id][l];

/** Every stronghold has a set (the kit's 24, in the series' order). */
export const WAROWNIA_IDS: readonly WarowniaId[] = WAROWNIE.map(w => w.id);
