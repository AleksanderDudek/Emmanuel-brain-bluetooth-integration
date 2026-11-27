/**
 * Złota passa's moment sets in Polish (the source), English, German and Swedish (DESIGN.md §26): for each moment of
 * content.ts its grey side (`what`: what happened, ≤ 64 characters) and its gold side (`wins`: ≤ 56 characters each —
 * a joy one, a snag two or three reframes, a heavy two or three humble hopes; "not yet — I trust" is added to every
 * heavy card by the sim), and the wins a player's own moment gets when they brought none.
 *
 * The reel's spirit in our words: noticing (the coffee, the green light), reframing (the far parking spot = more steps),
 * and with the hard things only hope with humility — never "that is why it happened to you", never a promise of healing
 * or of a reward.  Polish never genders the player (present tense, nouns, "mogę", "uczę się"); German and Swedish say
 * "du" where they address; quotation marks: pl „…”, de „…“, sv ”…”, en “…”.  The types hold every language to the
 * same moments; the tests hold them to the same number of wins and to the limits.
 */
import { lang, type Lang } from '../../i18n';
import type { MomentKind } from './moments';

export interface SetWords { what: string; wins: readonly string[] }

const pl = {
  // ── joys ──
  coffee: { what: 'Pierwszy łyk ciepłej kawy', wins: ['Tyle radości za parę groszy — dziękuję'] },
  green: { what: 'Zielone światło, akurat gdy dochodzę', wins: ['Dziękuję za ten mały prezent na dzień dobry'] },
  sun: { what: 'Słońce na twarzy po wyjściu z domu', wins: ['Dziękuję za to ciepło na twarzy'] },
  bird: { what: 'Ptak śpiewa za oknem', wins: ['Dziękuję za ten śpiew o poranku'] },
  seat: { what: 'Wolne miejsce w autobusie', wins: ['Dziękuję za chwilę odpoczynku w drodze'] },
  message: { what: 'Wiadomość: „Myślę o Tobie”', wins: ['Dziękuję, że ktoś o mnie pamięta'] },
  water: { what: 'Szklanka zimnej wody w upale', wins: ['Dziękuję za czystą wodę'] },
  smile: { what: 'Uśmiech kogoś obcego w sklepie', wins: ['Dziękuję za ten uśmiech — oddam go dalej'] },
  meal: { what: 'Dobry obiad, zjedzony powoli', wins: ['Dziękuję za chleb powszedni'] },
  praise: { what: 'Ktoś mówi: „Dobra robota”', wins: ['Dziękuję za to dobre słowo'] },
  card: { what: 'Kartka od kogoś bliskiego', wins: ['Dziękuję za bliskich, choć są daleko'] },
  flowers: { what: 'Kwiaty kwitną przy drodze', wins: ['Dziękuję za piękno po drodze'] },
  quiet: { what: 'Pięć minut ciszy tylko dla mnie', wins: ['Dziękuję za tę chwilę ciszy'] },
  sunset: { what: 'Złoty zachód słońca nad dachami', wins: ['Dziękuję za piękno tego dnia'] },
  home: { what: 'Ktoś w domu cieszy się na mój widok', wins: ['Dziękuję za bliskich, do których wracam'] },
  bed: { what: 'Ciepłe łóżko na koniec dnia', wins: ['Dziękuję za dach nad głową i odpoczynek'] },
  // ── snags ──
  parking: { what: 'Jedyne wolne miejsce — na końcu parkingu', wins: ['Więcej kroków — dla zdrowia', 'Kilka minut na świeżym powietrzu', 'Ktoś inny zaparkuje bliżej drzwi'] },
  rain: { what: 'Pada, a parasol został w domu', wins: ['Ziemia pije — a ja mogę zwolnić', 'Deszcz pachnie świeżością', 'Dobry powód do ciepłej herbaty'] },
  delay: { what: 'Pociąg ma 20 minut spóźnienia', wins: ['Niespodziewany czas na oddech', 'Chwila, by zadzwonić do kogoś bliskiego'] },
  spill: { what: 'Kawa rozlana na stół', wins: ['To tylko kawa — dzień wciąż jest dobry', 'Uczę się śmiać z drobiazgów'] },
  missed: { what: 'Autobus odjechał sprzed nosa', wins: ['Następny przyjedzie — mam chwilę dla siebie', 'Krótki spacer dobrze mi zrobi'] },
  keys: { what: 'Klucze gdzieś się zapodziały', wins: ['Zwalniam — pośpiech i tak nie pomoże', 'Znajdę je — i uśmiechnę się z ulgą'] },
  queue: { what: 'Długa kolejka w sklepie', wins: ['Chwila na krótką modlitwę', 'Czas, by zauważyć ludzi wokół', 'Lekcja cierpliwości'] },
  stain: { what: 'Plama na koszuli przed ważną rozmową', wins: ['Nikt nie musi być idealny', 'Ludzie słuchają serca, nie koszuli'] },
  doctor: { what: 'Długie czekanie w przychodni', wins: ['Jest tu ktoś, kto mi pomoże', 'Chwila, by pomodlić się za czekających'] },
  meeting: { what: 'Długie, nużące zebranie', wins: ['Ćwiczę cierpliwość i słuchanie', 'Mogę po cichu pomodlić się za tych ludzi'] },
  mistake: { what: 'Pomyłka w pracy', wins: ['Teraz wiem więcej niż rano', 'Mogę przeprosić i naprawić — to też siła'] },
  battery: { what: 'Telefon się rozładował', wins: ['Chwila bez ekranu — rozglądam się wokół', 'Wiadomości poczekają — świat się nie wali'] },
  cancel: { what: 'Spotkanie odwołane w ostatniej chwili', wins: ['Wolny wieczór — prezent na odpoczynek', 'Czas dla tych, dla których zwykle go brak'] },
  bill: { what: 'Rachunek wyższy, niż było w planie', wins: ['Mam z czego zapłacić — dziękuję', 'Uczę się planować spokojniej'] },
  traffic: { what: 'Korek w drodze do domu', wins: ['Czas na ulubioną muzykę', 'Chwila, by pomodlić się za kierowców wokół'] },
  cold: { what: 'Katar i drapanie w gardle', wins: ['Ciało prosi o odpoczynek — słucham go', 'Herbata z miodem i wcześniejszy sen'] },
  // ── heavies ──
  diagnosis: { what: 'Trudna diagnoza', wins: ['Uczę się prosić o pomoc', 'Każdy dzień staje się cenniejszy', 'Bóg jest blisko złamanych na duchu'] },
  loss: { what: 'Odejście kogoś bliskiego', wins: ['Miłość nie znika — noszę ją dalej', 'Łzy też są modlitwą', 'Ta strata może kiedyś pomóc mi pocieszać innych'] },
  job: { what: 'Utrata pracy', wins: ['Moja wartość nie zależy od stanowiska', 'Może otwiera się droga, której nie widzę', 'Uczę się przyjmować pomoc'] },
  breakup: { what: 'Koniec ważnej relacji', wins: ['Uczę się, kim jestem w Bożych oczach', 'Moja historia może kiedyś dodać komuś odwagi'] },
  body: { what: 'Ciało, które nie daje rady jak dawniej', wins: ['Jestem kimś więcej niż moje ciało', 'Uczę się łagodności dla siebie', 'Bóg patrzy na serce'] },
  lonely: { what: 'Długie dni w samotności', wins: ['Bóg jest tu — także w ciszy', 'Mogę dziś do kogoś napisać', 'Ktoś inny też czeka na dobre słowo'] },
  failure: { what: 'Plan, który się nie udał', wins: ['Upadek to nie koniec drogi', 'Uczę się pokory i wstawania', 'Moja historia może kiedyś dodać komuś odwagi'] },
  wait: { what: 'Długie czekanie bez odpowiedzi', wins: ['Uczę się czekać z nadzieją', 'Bóg jest ze mną w czekaniu'] },
};

export type SetId = keyof typeof pl;
type Sets = Readonly<Record<SetId, SetWords>>;

const en: Sets = {
  coffee: { what: 'The first sip of a warm coffee', wins: ['So much joy for pocket change — grateful'] },
  green: { what: 'A green light, just as I get there', wins: ['Grateful for this small gift to start the day'] },
  sun: { what: 'Sun on my face as I step outside', wins: ['Grateful for this warmth on my face'] },
  bird: { what: 'A bird singing outside the window', wins: ['Grateful for this morning song'] },
  seat: { what: 'A free seat on the bus', wins: ['Grateful for a moment of rest on the way'] },
  message: { what: 'A message: “Thinking of you”', wins: ['Grateful that someone remembers me'] },
  water: { what: 'A glass of cold water on a hot day', wins: ['Grateful for clean water'] },
  smile: { what: 'A stranger’s smile in the shop', wins: ['Grateful for that smile — I’ll pass it on'] },
  meal: { what: 'A good lunch, eaten slowly', wins: ['Grateful for my daily bread'] },
  praise: { what: 'Someone says: “Good job”', wins: ['Grateful for that kind word'] },
  card: { what: 'A card from someone dear', wins: ['Grateful for loved ones, even far away'] },
  flowers: { what: 'Flowers blooming by the road', wins: ['Grateful for beauty along the way'] },
  quiet: { what: 'Five quiet minutes just for me', wins: ['Grateful for this moment of quiet'] },
  sunset: { what: 'A golden sunset over the rooftops', wins: ['Grateful for the beauty of this day'] },
  home: { what: 'Someone at home glad to see me', wins: ['Grateful for the people I come home to'] },
  bed: { what: 'A warm bed at the end of the day', wins: ['Grateful for a roof over my head and rest'] },
  parking: { what: 'The only free spot — at the far end of the lot', wins: ['More steps — good for my health', 'A few minutes of fresh air', 'Someone else gets to park by the door'] },
  rain: { what: 'Rain, and my umbrella is at home', wins: ['The earth drinks — and I can slow down', 'The rain smells fresh', 'A good reason for a warm cup of tea'] },
  delay: { what: 'The train is 20 minutes late', wins: ['Unexpected time to breathe', 'A moment to call someone dear'] },
  spill: { what: 'Coffee spilled across the table', wins: ['It’s only coffee — the day is still good', 'Learning to laugh at small things'] },
  missed: { what: 'The bus pulled away right in front of me', wins: ['Another will come — a moment for myself', 'A short walk will do me good'] },
  keys: { what: 'My keys have gone missing', wins: ['I slow down — rushing won’t help anyway', 'I’ll find them — and smile with relief'] },
  queue: { what: 'A long queue at the shop', wins: ['Time for a short prayer', 'Time to notice the people around me', 'A lesson in patience'] },
  stain: { what: 'A stain on my shirt before an important talk', wins: ['No one has to be perfect', 'People listen to the heart, not the shirt'] },
  doctor: { what: 'A long wait at the clinic', wins: ['There is someone here to help me', 'A moment to pray for those waiting'] },
  meeting: { what: 'A long, tiring meeting', wins: ['Practising patience and listening', 'I can quietly pray for these people'] },
  mistake: { what: 'A mistake at work', wins: ['Now I know more than this morning', 'I can apologise and fix it — that’s strength'] },
  battery: { what: 'My phone’s battery died', wins: ['A moment without a screen — I look around', 'The messages can wait — the world goes on'] },
  cancel: { what: 'A plan cancelled at the last minute', wins: ['A free evening — a gift of rest', 'Time for those I rarely have time for'] },
  bill: { what: 'A bill higher than I planned for', wins: ['I can pay it — grateful for that', 'Learning to plan more calmly'] },
  traffic: { what: 'A traffic jam on the way home', wins: ['Time for my favourite music', 'A moment to pray for the drivers around me'] },
  cold: { what: 'A runny nose and a scratchy throat', wins: ['My body asks for rest — I listen', 'Tea with honey and an early night'] },
  diagnosis: { what: 'A hard diagnosis', wins: ['Learning to ask for help', 'Every day becomes more precious', 'God is near to the brokenhearted'] },
  loss: { what: 'Losing someone dear', wins: ['Love does not end — I carry it on', 'Tears are a prayer too', 'One day this loss may help me comfort others'] },
  job: { what: 'Losing my job', wins: ['My worth does not depend on a job title', 'Maybe a way is opening that I can’t see yet', 'Learning to accept help'] },
  breakup: { what: 'The end of an important relationship', wins: ['Learning who I am in God’s eyes', 'My story may one day give someone courage'] },
  body: { what: 'A body that can’t do what it used to', wins: ['I am more than my body', 'Learning to be gentle with myself', 'God looks at the heart'] },
  lonely: { what: 'Long days of loneliness', wins: ['God is here — in the silence too', 'I can write to someone today', 'Someone else is waiting for a kind word too'] },
  failure: { what: 'A plan that failed', wins: ['A fall is not the end of the road', 'Learning humility and how to get up', 'My story may one day give someone courage'] },
  wait: { what: 'A long wait with no answer', wins: ['Learning to wait with hope', 'God is with me in the waiting'] },
};

const de: Sets = {
  coffee: { what: 'Der erste Schluck warmer Kaffee', wins: ['So viel Freude für ein paar Münzen — danke'] },
  green: { what: 'Grün, genau als ich ankomme', wins: ['Danke für dieses kleine Geschenk am Morgen'] },
  sun: { what: 'Sonne im Gesicht, als ich hinausgehe', wins: ['Danke für diese Wärme im Gesicht'] },
  bird: { what: 'Ein Vogel singt vor dem Fenster', wins: ['Danke für dieses Morgenlied'] },
  seat: { what: 'Ein freier Platz im Bus', wins: ['Danke für eine kleine Pause unterwegs'] },
  message: { what: 'Eine Nachricht: „Ich denk an dich“', wins: ['Danke, dass jemand an mich denkt'] },
  water: { what: 'Ein Glas kaltes Wasser in der Hitze', wins: ['Danke für sauberes Wasser'] },
  smile: { what: 'Das Lächeln eines Fremden im Laden', wins: ['Danke für dieses Lächeln — ich gebe es weiter'] },
  meal: { what: 'Ein gutes Mittagessen, langsam gegessen', wins: ['Danke für das tägliche Brot'] },
  praise: { what: 'Jemand sagt: „Gut gemacht“', wins: ['Danke für dieses gute Wort'] },
  card: { what: 'Eine Karte von einem lieben Menschen', wins: ['Danke für liebe Menschen, auch in der Ferne'] },
  flowers: { what: 'Blumen blühen am Wegrand', wins: ['Danke für die Schönheit am Weg'] },
  quiet: { what: 'Fünf stille Minuten nur für mich', wins: ['Danke für diesen stillen Moment'] },
  sunset: { what: 'Goldener Sonnenuntergang über den Dächern', wins: ['Danke für die Schönheit dieses Tages'] },
  home: { what: 'Zu Hause freut sich jemand auf mich', wins: ['Danke für die Menschen, zu denen ich heimkomme'] },
  bed: { what: 'Ein warmes Bett am Ende des Tages', wins: ['Danke für ein Dach über dem Kopf und Ruhe'] },
  parking: { what: 'Der einzige freie Platz — ganz hinten', wins: ['Mehr Schritte — gut für die Gesundheit', 'Ein paar Minuten frische Luft', 'Jemand anderes parkt näher an der Tür'] },
  rain: { what: 'Es regnet, und der Schirm ist zu Hause', wins: ['Die Erde trinkt — und ich darf langsamer werden', 'Der Regen riecht frisch', 'Ein guter Grund für einen warmen Tee'] },
  delay: { what: 'Der Zug hat 20 Minuten Verspätung', wins: ['Unerwartete Zeit zum Durchatmen', 'Ein Moment, einen lieben Menschen anzurufen'] },
  spill: { what: 'Kaffee über den Tisch verschüttet', wins: ['Nur Kaffee — der Tag ist immer noch gut', 'Ich lerne, über Kleinigkeiten zu lachen'] },
  missed: { what: 'Der Bus fährt mir vor der Nase weg', wins: ['Der nächste kommt — ein Moment für mich', 'Ein kurzer Spaziergang tut mir gut'] },
  keys: { what: 'Meine Schlüssel sind verschwunden', wins: ['Ich werde langsamer — Eile hilft ohnehin nicht', 'Ich finde sie — und lächle erleichtert'] },
  queue: { what: 'Eine lange Schlange im Laden', wins: ['Zeit für ein kurzes Gebet', 'Zeit, die Menschen um mich zu sehen', 'Eine Lektion in Geduld'] },
  stain: { what: 'Ein Fleck auf dem Hemd vor einem Gespräch', wins: ['Niemand muss perfekt sein', 'Man hört aufs Herz, nicht aufs Hemd'] },
  doctor: { what: 'Langes Warten in der Arztpraxis', wins: ['Hier ist jemand, der mir hilft', 'Ein Moment, für die Wartenden zu beten'] },
  meeting: { what: 'Eine lange, ermüdende Besprechung', wins: ['Ich übe Geduld und Zuhören', 'Ich kann still für diese Menschen beten'] },
  mistake: { what: 'Ein Fehler bei der Arbeit', wins: ['Jetzt weiß ich mehr als heute Morgen', 'Ich kann es richten — auch das ist Stärke'] },
  battery: { what: 'Der Akku vom Handy ist leer', wins: ['Ein Moment ohne Bildschirm — ich schaue auf', 'Die Nachrichten können warten'] },
  cancel: { what: 'Ein Treffen in letzter Minute abgesagt', wins: ['Ein freier Abend — ein Geschenk der Ruhe', 'Zeit für die, für die sie sonst fehlt'] },
  bill: { what: 'Eine Rechnung, höher als geplant', wins: ['Ich kann sie bezahlen — dafür danke', 'Ich lerne, ruhiger zu planen'] },
  traffic: { what: 'Stau auf dem Heimweg', wins: ['Zeit für meine Lieblingsmusik', 'Ein Moment, für die Fahrer ringsum zu beten'] },
  cold: { what: 'Schnupfen und ein Kratzen im Hals', wins: ['Mein Körper bittet um Ruhe — ich höre hin', 'Tee mit Honig und früh ins Bett'] },
  diagnosis: { what: 'Eine schwere Diagnose', wins: ['Ich lerne, um Hilfe zu bitten', 'Jeder Tag wird kostbarer', 'Gott ist nahe den zerbrochenen Herzen'] },
  loss: { what: 'Ein lieber Mensch ist gegangen', wins: ['Liebe hört nicht auf — ich trage sie weiter', 'Auch Tränen sind ein Gebet', 'Der Verlust kann mir einst helfen, andere zu trösten'] },
  job: { what: 'Die Arbeit verloren', wins: ['Mein Wert hängt nicht an einer Stelle', 'Vielleicht öffnet sich ein Weg, den ich nicht sehe', 'Ich lerne, Hilfe anzunehmen'] },
  breakup: { what: 'Das Ende einer wichtigen Beziehung', wins: ['Ich lerne, wer ich in Gottes Augen bin', 'Meine Geschichte kann einst jemandem Mut machen'] },
  body: { what: 'Ein Körper, der nicht mehr kann wie früher', wins: ['Ich bin mehr als mein Körper', 'Ich lerne, sanft mit mir zu sein', 'Gott sieht das Herz an'] },
  lonely: { what: 'Lange Tage der Einsamkeit', wins: ['Gott ist hier — auch in der Stille', 'Ich kann heute jemandem schreiben', 'Auch jemand wartet auf ein gutes Wort'] },
  failure: { what: 'Ein Plan, der gescheitert ist', wins: ['Ein Fall ist nicht das Ende des Weges', 'Ich lerne Demut und Aufstehen', 'Meine Geschichte kann einst jemandem Mut machen'] },
  wait: { what: 'Langes Warten ohne Antwort', wins: ['Ich lerne, mit Hoffnung zu warten', 'Gott ist bei mir im Warten'] },
};

const sv: Sets = {
  coffee: { what: 'Första klunken varmt kaffe', wins: ['Så mycket glädje för några mynt — tack'] },
  green: { what: 'Grönt ljus, precis när jag kommer fram', wins: ['Tack för den lilla gåvan i morgonstunden'] },
  sun: { what: 'Sol i ansiktet när jag går ut', wins: ['Tack för värmen i ansiktet'] },
  bird: { what: 'En fågel sjunger utanför fönstret', wins: ['Tack för morgonens sång'] },
  seat: { what: 'En ledig plats på bussen', wins: ['Tack för en stunds vila på vägen'] },
  message: { what: 'Ett meddelande: ”Tänker på dig”', wins: ['Tack för att någon tänker på mig'] },
  water: { what: 'Ett glas kallt vatten i värmen', wins: ['Tack för rent vatten'] },
  smile: { what: 'En främlings leende i affären', wins: ['Tack för leendet — jag skickar det vidare'] },
  meal: { what: 'En god lunch, äten i lugn och ro', wins: ['Tack för det dagliga brödet'] },
  praise: { what: 'Någon säger: ”Bra jobbat”', wins: ['Tack för det vänliga ordet'] },
  card: { what: 'Ett kort från någon kär', wins: ['Tack för nära och kära, även på avstånd'] },
  flowers: { what: 'Blommor blommar vid vägen', wins: ['Tack för skönheten längs vägen'] },
  quiet: { what: 'Fem tysta minuter bara för mig', wins: ['Tack för den här stunden av stillhet'] },
  sunset: { what: 'En gyllene solnedgång över taken', wins: ['Tack för den här dagens skönhet'] },
  home: { what: 'Någon där hemma blir glad att se mig', wins: ['Tack för dem jag får komma hem till'] },
  bed: { what: 'En varm säng när dagen är slut', wins: ['Tack för tak över huvudet och vila'] },
  parking: { what: 'Enda lediga platsen — längst bort', wins: ['Fler steg — bra för hälsan', 'Några minuter i friska luften', 'Någon annan får parkera närmare dörren'] },
  rain: { what: 'Det regnar, och paraplyet är hemma', wins: ['Jorden dricker — och jag kan sakta ner', 'Regnet doftar friskt', 'Ett gott skäl till en varm kopp te'] },
  delay: { what: 'Tåget är 20 minuter försenat', wins: ['Oväntad tid att andas', 'En stund att ringa någon kär'] },
  spill: { what: 'Kaffe utspillt över bordet', wins: ['Bara kaffe — dagen är fortfarande god', 'Jag lär mig skratta åt småsaker'] },
  missed: { what: 'Bussen åkte precis framför mig', wins: ['Nästa kommer — en stund för mig själv', 'En kort promenad gör mig gott'] },
  keys: { what: 'Nycklarna har kommit bort', wins: ['Jag saktar ner — brådska hjälper ändå inte', 'Jag hittar dem — och ler av lättnad'] },
  queue: { what: 'En lång kö i affären', wins: ['Tid för en kort bön', 'Tid att se människorna omkring mig', 'En lektion i tålamod'] },
  stain: { what: 'En fläck på skjortan före ett viktigt samtal', wins: ['Ingen behöver vara perfekt', 'Folk lyssnar på hjärtat, inte på skjortan'] },
  doctor: { what: 'Lång väntan på vårdcentralen', wins: ['Här finns någon som hjälper mig', 'En stund att be för dem som väntar'] },
  meeting: { what: 'Ett långt, tröttsamt möte', wins: ['Jag övar tålamod och att lyssna', 'Jag kan tyst be för de här människorna'] },
  mistake: { what: 'Ett misstag på jobbet', wins: ['Nu vet jag mer än i morse', 'Jag kan rätta till det — det är också styrka'] },
  battery: { what: 'Mobilen har laddat ur', wins: ['En stund utan skärm — jag ser mig omkring', 'Meddelandena kan vänta — världen går vidare'] },
  cancel: { what: 'En träff inställd i sista minuten', wins: ['En ledig kväll — en gåva av vila', 'Tid för dem jag sällan hinner med'] },
  bill: { what: 'En räkning högre än jag räknat med', wins: ['Jag kan betala den — tack för det', 'Jag lär mig planera lugnare'] },
  traffic: { what: 'Kö på vägen hem', wins: ['Tid för min favoritmusik', 'En stund att be för förarna runt omkring'] },
  cold: { what: 'Snuva och skrapigt i halsen', wins: ['Kroppen ber om vila — jag lyssnar', 'Te med honung och tidigt i säng'] },
  diagnosis: { what: 'En svår diagnos', wins: ['Jag lär mig be om hjälp', 'Varje dag blir mer dyrbar', 'Gud är nära dem med förkrossat hjärta'] },
  loss: { what: 'En kär människa har gått bort', wins: ['Kärleken tar inte slut — jag bär den vidare', 'Tårar är också en bön', 'En dag kan förlusten hjälpa mig trösta andra'] },
  job: { what: 'Att förlora jobbet', wins: ['Mitt värde hänger inte på en tjänst', 'Kanske öppnas en väg som jag inte ser än', 'Jag lär mig ta emot hjälp'] },
  breakup: { what: 'Slutet på en viktig relation', wins: ['Jag lär mig vem jag är i Guds ögon', 'Min historia kan en dag ge någon mod'] },
  body: { what: 'En kropp som inte orkar som förr', wins: ['Jag är mer än min kropp', 'Jag lär mig vara mild mot mig själv', 'Gud ser till hjärtat'] },
  lonely: { what: 'Långa dagar av ensamhet', wins: ['Gud är här — också i tystnaden', 'Jag kan skriva till någon i dag', 'Någon annan väntar också på ett vänligt ord'] },
  failure: { what: 'En plan som misslyckades', wins: ['Ett fall är inte slutet på vägen', 'Jag lär mig ödmjukhet och att resa mig', 'Min historia kan en dag ge någon mod'] },
  wait: { what: 'Lång väntan utan svar', wins: ['Jag lär mig vänta med hopp', 'Gud är med mig i väntan'] },
};

export const SET_TEXTS: Readonly<Record<Lang, Sets>> = { pl, en, de, sv };

/** A set moment's words in a language (the page's by default; null for an unknown id). */
export function setWords(id: string, l: Lang = lang): SetWords | null {
  const cat = SET_TEXTS[l] as Readonly<Record<string, SetWords>>;
  return Object.prototype.hasOwnProperty.call(cat, id) ? cat[id] : null;
}

/** "Not yet — I trust": on every heavy card. */
export const TRUST: Readonly<Record<Lang, string>> = {
  pl: 'Jeszcze tego nie widzę — ufam',
  en: 'I can’t see it yet — I trust',
  de: 'Ich sehe es noch nicht — ich vertraue',
  sv: 'Jag ser det inte än — jag litar på Gud',
};

/** The gold side of a player's own moment when they brought no win of their own (a joy one; a snag, a heavy three). */
export const OWN_WINS: Readonly<Record<Lang, Readonly<Record<MomentKind, readonly string[]>>>> = {
  pl: {
    joy: ['Dziękuję za to dobro'],
    snag: ['I w tym jest coś dobrego', 'Uczę się w tym cierpliwości', 'Bóg jest i tutaj'],
    heavy: ['Bóg jest blisko złamanych na duchu', 'Uczę się prosić o pomoc', 'Moja historia może kiedyś dodać komuś odwagi'],
  },
  en: {
    joy: ['Grateful for this good thing'],
    snag: ['There is some good in this too', 'Learning patience in this', 'God is here too'],
    heavy: ['God is near to the brokenhearted', 'Learning to ask for help', 'My story may one day give someone courage'],
  },
  de: {
    joy: ['Danke für dieses Gute'],
    snag: ['Auch darin steckt etwas Gutes', 'Ich lerne darin Geduld', 'Gott ist auch hier'],
    heavy: ['Gott ist nahe den zerbrochenen Herzen', 'Ich lerne, um Hilfe zu bitten', 'Meine Geschichte kann einst jemandem Mut machen'],
  },
  sv: {
    joy: ['Tack för det goda'],
    snag: ['Också i detta finns något gott', 'Jag lär mig tålamod i detta', 'Gud är här också'],
    heavy: ['Gud är nära dem med förkrossat hjärta', 'Jag lär mig be om hjälp', 'Min historia kan en dag ge någon mod'],
  },
};
