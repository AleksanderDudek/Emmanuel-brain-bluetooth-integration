/**
 * Latarnik's data: the fishing village built from delivered crates, the amber album ("Bursztyny"),
 * the letters in bottles ("Listy z butelki") and the short lines the game shows during play.
 * Everything a designer may want to tune without touching the rules (sim.ts).
 */

export interface VillageStep { id: string; name: string; short: string; cost: number }

/** The harbour around the lighthouse, built in this order; one step is about one session of play. */
export const VILLAGE: readonly VillageStep[] = [
  { id: 'pomost', name: 'Pomost', short: 'Pomost', cost: 150 },
  { id: 'sieci', name: 'Sieci', short: 'Sieci', cost: 150 },
  { id: 'wedzarnia', name: 'Wędzarnia', short: 'Wędzarnia', cost: 150 },
  { id: 'chata', name: 'Chata rybacka', short: 'Chata', cost: 150 },
  { id: 'chata2', name: 'Druga chata', short: 'Chata II', cost: 150 },
  { id: 'kapliczka', name: 'Kapliczka rybacka', short: 'Kapliczka', cost: 150 },
  { id: 'lodzie', name: 'Łodzie przy brzegu', short: 'Łodzie', cost: 150 },
  { id: 'muzeum', name: 'Muzeum latarni', short: 'Muzeum', cost: 150 },
];

/** The first step starts half-built, "za kalibrację" (an endowed start). */
export const START_CRATES = 75;
/** The village step whose smoke turns days away into a welcome-back bonus. */
export const SMOKEHOUSE = 2;

export type Tier = 'common' | 'rare' | 'epic' | 'legend';
export const TIERS: readonly Tier[] = ['common', 'rare', 'epic', 'legend'];
export const TIER_NAME: Record<Tier, string> = { common: 'zwykły', rare: 'rzadki', epic: 'epicki', legend: 'legendarny' };
/** The album tile's class in styles.css (.arcade-album > div.rare …). */
export const TIER_CLASS: Record<Tier, string> = { common: '', rare: 'rare', epic: 'epic', legend: 'legend' };
/** The honest feat that earns a draw of each tier (published in the lobby). */
export const TIER_FEAT: Record<Tier, string> = {
  common: 'udana Cisza', rare: '12 s głębokiego spokoju', epic: 'Cisza po Konwoju w ciemno', legend: 'kontrast sesji ≥ +5%',
};

export type Inclusion = 'komar' | 'mrowka' | 'lisc' | 'nasiono' | 'pioro' | 'zuk' | 'pajak' | 'kwiat' | 'jaszczurka';

const INCLUSIONS: readonly { id: Inclusion; name: string; tier: Tier }[] = [
  { id: 'komar', name: 'Komar', tier: 'common' },
  { id: 'mrowka', name: 'Mrówka', tier: 'common' },
  { id: 'lisc', name: 'Liść', tier: 'common' },
  { id: 'nasiono', name: 'Nasiono', tier: 'common' },
  { id: 'pioro', name: 'Pióro', tier: 'rare' },
  { id: 'zuk', name: 'Żuk', tier: 'rare' },
  { id: 'pajak', name: 'Pająk', tier: 'epic' },
  { id: 'kwiat', name: 'Kwiat', tier: 'epic' },
  { id: 'jaszczurka', name: 'Jaszczurka', tier: 'legend' },
];

/** Two sets of nine: the clear honey amber of the bay and the darker, cherry amber of the spit. */
export const SETS: readonly { name: string; tone: 'honey' | 'cherry' }[] = [
  { name: 'Zatoka', tone: 'honey' },
  { name: 'Mierzeja', tone: 'cherry' },
];

export interface AmberPiece { index: number; set: number; inclusion: Inclusion; name: string; tier: Tier }

export const AMBER: readonly AmberPiece[] = SETS.flatMap((_, set) =>
  INCLUSIONS.map((inc, i) => ({ index: set * INCLUSIONS.length + i, set, inclusion: inc.id, name: inc.name, tier: inc.tier })));

/** A duplicate becomes crumbs; enough crumbs become the album's next missing piece. */
export const DUPLICATE_OKRUCHY = 5;
export const CRAFT_OKRUCHY = 25;

/**
 * Hania, the old keeper's daughter, writes to the new keeper from the village by the lighthouse.
 * One bottle a session; each letter at most 380 characters.
 */
export const LETTERS: readonly string[] = [
  'Dzień dobry, Latarniku. Tata mówi, że skoro światło znowu się kręci, ktoś powinien wiedzieć, co u nas słychać. Więc piszę. Mieszkamy w trzecim domu od pomostu, tym z niebieskimi okiennicami. Rano mgła była taka gęsta, że kuter pana Edka trafił do portu po zapachu wędzarni. Jutro ma się przejaśnić. Hania',
  'Babcia piecze chleb we wtorki i w piątki. Zakwas trzyma w kamionce, która pamięta jeszcze dziadka. Mówi, że ciasto lubi ciszę, więc wtedy w kuchni nie wolno trzaskać drzwiami. Zostawiłam Panu bochenek przy furtce pod latarnią, zawinięty w lnianą ścierkę. Jeśli mewy były szybsze, to przepraszam za mewy. Hania',
  'Na mieliźnie za cyplem leży foka. Szara, gruba, z wąsami jak u listonosza. Leży tam trzeci dzień i nic sobie z nas nie robi. Pani z fundacji mówi, że odpoczywa i żeby nie podchodzić bliżej niż na sto kroków. Liczyłam. Wyszło sto dwanaście, bo piasek był mokry i stawiałam krótkie kroki. Hania',
  'Wieczorem siedzieliśmy z tatą przy radiu. Prognoza dla rybaków: wiatr zachodni, piątka, w porywach siódemka, fala dwa metry. Tata powtarza ją na głos, słowo w słowo, jakby chciał ją zapamiętać na zawsze. Potem grali stare piosenki i mama tańczyła z miotłą. Kutry zostały w porcie. Hania',
  'Dziś suszyliśmy sieci na palach przy plaży. Są ciężkie od wody i pachną wodorostami, a w oczkach zawsze coś zostaje: muszelka, patyk, raz nawet łyżeczka. Pan Edek ceruje dziury szybciej, niż ja wiążę sznurówki. Obiecał, że w zimie nauczy mnie węzła, którego nie da się rozplątać. Hania',
  'W nocy był sztorm. Okna dzwoniły, a w kominie ktoś gwizdał na jednej nucie. Mama zapaliła świecę, chociaż prąd był. Siedziałam przy oknie i patrzyłam na Pana światło: błysk, przerwa, błysk. Póki się kręciło, wiedziałam, że wszystko jest na swoim miejscu. Rano plaża była cała w gałęziach. Hania',
  'Po sztormie wszyscy idą na plażę szukać bursztynu. Najlepiej o świcie, w gumowcach, z siatką na długim kiju. Babcia mówi, że bursztyn wypływa do tych, którzy się nie spieszą. Znalazłam jeden, mały jak ziarnko grochu, ale w środku ma bąbelek powietrza sprzed milionów lat. Trzymam go w pudełku po herbacie. Hania',
  'W wędzarni pana Edka pachnie olchą i dymem. Wieszamy szprotki na prętach, rzędami, jak pranie na sznurku. Trzeba pilnować, żeby drewno się tliło, a nie paliło. Siedziałam tam całe popołudnie i teraz pachną mi włosy. Mama mówi, że w domu jest jak w wędzarni. Tata, że to najlepszy zapach świata. Hania',
  'Przy drodze do portu stoi drewniana kapliczka. Ktoś co tydzień zostawia przy niej świeże kwiaty, zwykle wrzosy albo rumianki, i nikt nie wie kto. Babcia podejrzewa listonosza, mama panią z piekarni. Ja stawiam na pana Edka, bo ma ziemię pod paznokciami, a przecież nie ma ogródka. Hania',
  'Dziś przypłynął prom z turystami. Jedna dziewczynka zapytała, czy w latarni mieszka olbrzym, skoro ma takie wielkie oko. Powiedziałam, że mieszka tam Pan i że jest zupełnie zwyczajnego wzrostu. Chyba była zawiedziona. Dała mi za tę wiadomość miętowego cukierka, więc wyszłam na swoje. Hania',
  'Zatoka zamarza przy brzegu. Lód jest cienki i śpiewa, kiedy rzucić na niego kamyk: dźwięk leci daleko, jakby ktoś stroił gitarę pod wodą. Tata zabrania wchodzić, więc tylko rzucamy. Mewy chodzą po lodzie z bardzo poważnymi minami, jak urzędnicy na obchodzie. Hania',
  'Jutro tata pierwszy raz zabiera mnie na kutrze na całą noc. Babcia zapakowała chleb, smalec i termos herbaty z sokiem malinowym. Popłyniemy za Pana światłem aż na łowisko, a nad ranem z powrotem. Proszę nie gasić. Wiem, że Pan nie zgasi, ale i tak proszę. Odpiszę, jak wrócę. Hania',
];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [
    'Stuknij, gdy światło padnie na łódź.',
    'Środek promienia to „Idealnie”.',
    'Dalekie łodzie wiozą więcej skrzyń.',
  ],
  konwoj: [
    'Zaplanuj w myślach kurs każdej łodzi.',
    'Policz w myślach łodzie na horyzoncie.',
    'Wyobraź sobie port, deska po desce.',
    'Licz w myślach wstecz od 100 co 7.',
    'Przypomnij sobie drogę z domu, krok po kroku.',
  ],
  blind: [
    'W ciemno: prowadź światło z pamięci.',
    'Pierścienia nie widać, zasięg działa dalej.',
  ],
  cisza: [
    'Rozluźnij czoło, oddychaj zwyczajnie.',
    'Patrz miękko — morze rozjaśni się samo.',
    'Odpuść. Bursztyn wypłynie sam.',
  ],
  /** the first-ever Konwój and Cisza explain themselves */
  firstKonwoj: 'Zaplanuj kurs łodzi — światło sięgnie dalej.',
  firstCisza: 'Odpuść — morze zaświeci samo.',
} as const;

/** Polish plural: 1 łódź, 2–4 łodzie, 5+ łodzi (12–14 too). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const a = Math.abs(n) % 100, b = a % 10;
  return b >= 2 && b <= 4 && (a < 12 || a > 14) ? few : many;
}

/** The word for `n` boats: the headline's unit and every count of boats. */
export const boatWord = (n: number) => plural(n, 'łódź', 'łodzie', 'łodzi');
export const boats = (n: number) => `${n} ${boatWord(n)}`;
export const crates = (n: number) => `${n} ${plural(n, 'skrzynia', 'skrzynie', 'skrzyń')}`;
export const crumbs = (n: number) => `${n} ${plural(n, 'okruch', 'okruchy', 'okruchów')}`;

/** "Z daleka dopłynęły 3 statki" — the blind Konwój's reveal, with the verb agreeing too. */
export function farShips(n: number): string {
  if (n === 0) return 'Tym razem z daleka nie dopłynął żaden statek';
  if (n === 1) return 'Z daleka dopłynął 1 statek';
  return `Z daleka ${plural(n, '', 'dopłynęły', 'dopłynęło')} ${n} ${plural(n, '', 'statki', 'statków')}`;
}
