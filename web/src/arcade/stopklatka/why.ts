/**
 * Stop-klatka's "why" (DESIGN.md §28): the first-ever session's opening pages and the lobby's "Dlaczego to działa"
 * card, in Polish (the source), English, German and Swedish.  The keys the game reads (stopklatka/i18n, panel):
 *
 *   open.1 … open.4   the opening pages, one by one on the canvas before the first story (≤ 160 characters each)
 *   card.title        the card's heading
 *   card.1 … card.n   the card's paragraphs in order (read until a key is missing): what happens in anger, why a
 *                     pause works, the four steps of the freeze with their evidence, the prefrontal cortex, what the
 *                     band measures, what anger is for
 *   card.src          one line of sources
 *   card.not          what it is not (the game adds the helplines after it)
 *
 * Every source was checked on 2026-11-27: in PubMed where it is indexed (PMID below), and in Crossref for the two
 * papers PubMed does not index (Mischkowski, Kross & Bushman 2012 in J Exp Soc Psychol; Torre & Lieberman 2018 in
 * Emotion Review).  The "~90 s" first wave of anger is a popular figure, not a measured constant: the words say "often
 * a minute or two, if nothing feeds it", which is what the physiology (alarm hormones cleared within minutes) and the
 * studies of what prolongs an emotion (its trigger coming back, also in thought: Verduyn et al. 2009; rumination:
 * Bushman et al. 2005, Denson 2013) support.
 *
 * Words of the heart series (§18.3): no energy, no promise; the band measures attention, not prayer.  Polish without
 * gendered forms, the address capitalised; German and Swedish "du"; English ’ for apostrophes.  Quotation marks:
 * pl „…”, de „…“, sv ”…”, en “…”.
 */
import type { Lang } from '../../i18n';

/** A source of the card (all checked; `pmid` absent = not indexed in PubMed, checked by DOI). */
export interface WhySource { key: string; authors: string; year: number; title: string; journal: string; pmid?: string; doi: string }

export const WHY_SOURCES: readonly WhySource[] = [
  { key: 'kross2005', authors: 'Kross, Ayduk & Mischel', year: 2005, title: 'When asking “why” does not hurt. Distinguishing rumination from reflective processing of negative emotions', journal: 'Psychol Sci 16(9):709–715', pmid: '16137257', doi: '10.1111/j.1467-9280.2005.01600.x' },
  { key: 'ayduk2008', authors: 'Ayduk & Kross', year: 2008, title: 'Enhancing the pace of recovery: self-distanced analysis of negative experiences reduces blood pressure reactivity', journal: 'Psychol Sci 19(3):229–231', pmid: '18315794', doi: '10.1111/j.1467-9280.2008.02073.x' },
  { key: 'ayduk2010', authors: 'Ayduk & Kross', year: 2010, title: 'From a distance: implications of spontaneous self-distancing for adaptive self-reflection', journal: 'J Pers Soc Psychol 98(5):809–829', pmid: '20438226', doi: '10.1037/a0019205' },
  { key: 'mischkowski2012', authors: 'Mischkowski, Kross & Bushman', year: 2012, title: 'Flies on the wall are less aggressive: self-distancing “in the heat of the moment” reduces aggressive thoughts, angry feelings and aggressive behavior', journal: 'J Exp Soc Psychol 48(5):1187–1191', doi: '10.1016/j.jesp.2012.03.012' },
  { key: 'lieberman2007', authors: 'Lieberman et al.', year: 2007, title: 'Putting feelings into words: affect labeling disrupts amygdala activity in response to affective stimuli', journal: 'Psychol Sci 18(5):421–428', pmid: '17576282', doi: '10.1111/j.1467-9280.2007.01916.x' },
  { key: 'torre2018', authors: 'Torre & Lieberman', year: 2018, title: 'Putting feelings into words: affect labeling as implicit emotion regulation', journal: 'Emotion Review 10(2):116–124', doi: '10.1177/1754073917742706' },
  { key: 'gross1998', authors: 'Gross', year: 1998, title: 'Antecedent- and response-focused emotion regulation: divergent consequences for experience, expression, and physiology', journal: 'J Pers Soc Psychol 74(1):224–237', pmid: '9457784', doi: '10.1037/0022-3514.74.1.224' },
  { key: 'ochsner2002', authors: 'Ochsner et al.', year: 2002, title: 'Rethinking feelings: an fMRI study of the cognitive regulation of emotion', journal: 'J Cogn Neurosci 14(8):1215–1229', pmid: '12495527', doi: '10.1162/089892902760807212' },
  { key: 'buhle2014', authors: 'Buhle et al.', year: 2014, title: 'Cognitive reappraisal of emotion: a meta-analysis of human neuroimaging studies', journal: 'Cereb Cortex 24(11):2981–2990', pmid: '23765157', doi: '10.1093/cercor/bht154' },
  { key: 'zaccaro2018', authors: 'Zaccaro et al.', year: 2018, title: 'How breath-control can change your life: a systematic review on psycho-physiological correlates of slow breathing', journal: 'Front Hum Neurosci 12:353', pmid: '30245619', doi: '10.3389/fnhum.2018.00353' },
  { key: 'verduyn2009', authors: 'Verduyn et al.', year: 2009, title: 'Predicting the duration of emotional experience: two experience sampling studies', journal: 'Emotion 9(1):83–91', pmid: '19186919', doi: '10.1037/a0014610' },
  { key: 'bushman2005', authors: 'Bushman et al.', year: 2005, title: 'Chewing on it can chew you up: effects of rumination on triggered displaced aggression', journal: 'J Pers Soc Psychol 88(6):969–983', pmid: '15982116', doi: '10.1037/0022-3514.88.6.969' },
  { key: 'denson2013', authors: 'Denson', year: 2013, title: 'The multiple systems model of angry rumination', journal: 'Pers Soc Psychol Rev 17(2):103–123', pmid: '23175519', doi: '10.1177/1088868312467086' },
  { key: 'arnsten2009', authors: 'Arnsten', year: 2009, title: 'Stress signalling pathways that impair prefrontal cortex structure and function', journal: 'Nat Rev Neurosci 10(6):410–422', pmid: '19455173', doi: '10.1038/nrn2648' },
];

const pl: Readonly<Record<string, string>> = {
  'open.1': 'Złość to sygnał: coś ważnego zostało naruszone. Nie trzeba jej tłumić. Można ją zatrzymać, zanim zrobi coś za Ciebie.',
  'open.2': 'Zobaczysz zwykłe, trudne chwile własnymi oczami. Gdy wszystko zaczyna wrzeć, czas staje: stop-klatka.',
  'open.3': 'W stop-klatce robisz krok w bok i widzisz siebie z boku. Oddychasz wolno, nazywasz, co czujesz, i patrzysz jeszcze raz.',
  'open.4': 'Twoje skupienie napełnia krąg jasności. Opaska mierzy uwagę, nie modlitwę. Odpowiedź wybierasz, gdy jest jaśniej.',

  'card.title': 'Dlaczego to działa',
  'card.1': 'Co dzieje się w złości. Ciało reaguje szybciej niż myśl: serce przyspiesza, mięśnie się napinają, oddech się spłyca. To stary alarm, który ma Cię chronić.',
  'card.2': 'Pierwsza fala jest krótka. Jeśli nic jej nie podsyca, w ciele zwykle opada po minucie, dwóch. Złość trwa dłużej, gdy wracasz myślami do tego, co się stało: każde odtworzenie dolewa oliwy do ognia (Verduyn i in. 2009; Bushman i in. 2005).',
  'card.3': 'Dlatego pauza działa. Silny stres osłabia chwyt kory przedczołowej, tej części mózgu, która pomaga się zatrzymać (Arnsten 2009). Kilka spokojnych oddechów daje jej czas, by dogonić alarm.',
  'card.4': 'Krok 1: spojrzenie z boku. Gdy patrzysz na scenę jak ktoś z zewnątrz, „mucha na ścianie”, złość słabnie, a myśli o odwecie cichną. Tak pokazały badania Krossa i Ayduk oraz Mischkowskiego, Krossa i Bushmana (2012). Dlatego w stop-klatce kamera wychodzi z Twoich oczu.',
  'card.5': 'Krok 2: wolny oddech. Wdech na cztery, wydech na sześć. Oddychanie wolniejsze niż dziesięć oddechów na minutę uspokaja serce i obniża pobudzenie; w badaniach ludzie czuli po nim mniej niepokoju i złości (przegląd: Zaccaro i in. 2018).',
  'card.6': 'Krok 3: nazwij, co czujesz. Samo słowo „złość”, „żal” czy „wstyd” wycisza ośrodek alarmu w mózgu (ciało migdałowate), a pobudza korę przedczołową (Lieberman i in. 2007). To ciche porządkowanie emocji słowem (Torre i Lieberman 2018).',
  'card.7': 'Krok 4: drugie spojrzenie. Pytasz, co jeszcze może być prawdą i co będzie ważne za tydzień. Taka ponowna ocena zmniejsza przykre uczucie. Zaciskanie zębów i tłumienie tego nie robią, a napięcie w ciele nawet rośnie (Gross 1998).',
  'card.8': 'Kora przedczołowa trzyma lejce. Gdy nazywasz uczucie albo patrzysz jeszcze raz, pracuje kora przedczołowa, a ośrodek alarmu się wycisza (Ochsner i in. 2002; metaanaliza 48 badań: Buhle i in. 2014). To okolica, na którą patrzy Twoja opaska.',
  'card.9': 'Co tu ćwiczysz. W stop-klatce Twoje skupienie napełnia krąg jasności. Opaska mierzy uwagę, nie charakter i nie modlitwę. Pauzę ćwiczysz tam, gdzie jest bezpiecznie, jak każdą umiejętność: po trochu i wiele razy.',
  'card.10': 'Złość nie jest wrogiem. Mówi, że coś było ważne: szacunek, czas, bliscy, sprawiedliwość. Nie chodzi o to, by ją zgasić, tylko by odpowiedzieć z namysłu, a nie z odruchu. Odejście na chwilę też jest dobrą odpowiedzią, jeśli potem wracasz do rozmowy.',
  'card.src': 'Źródła: Kross, Ayduk i Mischel 2005; Ayduk i Kross 2008, 2010; Mischkowski, Kross i Bushman 2012; Lieberman i in. 2007; Torre i Lieberman 2018; Gross 1998; Ochsner i in. 2002; Buhle i in. 2014; Zaccaro i in. 2018; Verduyn i in. 2009; Bushman i in. 2005; Denson 2013; Arnsten 2009.',
  'card.not': 'To trening uwagi, nie terapia. Jeśli w domu jest przemoc albo Twoja złość Cię przeraża czy rani bliskich, nie zostawaj z tym w pojedynkę: porozmawiaj z psychologiem, lekarzem albo zadzwoń.',
};

const en: Readonly<Record<string, string>> = {
  'open.1': 'Anger is a signal: something that matters has been crossed. You don’t have to bury it. You can stop it before it acts for you.',
  'open.2': 'You will see ordinary, difficult moments through your own eyes. When everything starts to boil, time stops: a freeze frame.',
  'open.3': 'In the freeze you step aside and see yourself from outside. You breathe slowly, name what you feel and look again.',
  'open.4': 'Your focus fills a ring of clarity. The band measures attention, not prayer. You choose your answer once it is clearer.',

  'card.title': 'Why it works',
  'card.1': 'What happens in anger. The body reacts faster than thought: the heart speeds up, muscles tense, breathing goes shallow. It is an old alarm, meant to protect you.',
  'card.2': 'The first wave is short. If nothing feeds it, it usually ebbs in the body within a minute or two. Anger lasts longer when you go back over what happened: each replay adds fuel to the fire (Verduyn et al. 2009; Bushman et al. 2005).',
  'card.3': 'That is why a pause works. Strong stress loosens the grip of the prefrontal cortex, the part of the brain that helps you stop (Arnsten 2009). A few calm breaths give it time to catch up with the alarm.',
  'card.4': 'Step 1: a view from outside. When you watch the scene as an outsider would, a “fly on the wall”, anger weakens and thoughts of revenge go quiet. That is what studies by Kross and Ayduk, and by Mischkowski, Kross and Bushman (2012), found. So in the freeze the camera leaves your eyes.',
  'card.5': 'Step 2: slow breathing. In for four, out for six. Breathing slower than ten breaths a minute calms the heart and lowers arousal; in studies people felt less anxious and less angry afterwards (review: Zaccaro et al. 2018).',
  'card.6': 'Step 3: name what you feel. Just the word “anger”, “hurt” or “shame” quiets the brain’s alarm centre (the amygdala) and engages the prefrontal cortex (Lieberman et al. 2007). It is a quiet way of steadying an emotion with a word (Torre & Lieberman 2018).',
  'card.7': 'Step 4: a second look. You ask what else might be true and what will matter in a week. This reappraisal eases the painful feeling. Gritting your teeth and holding it in does not, and the tension in the body even rises (Gross 1998).',
  'card.8': 'The prefrontal cortex holds the reins. When you name a feeling or look again, the prefrontal cortex works and the alarm centre quiets down (Ochsner et al. 2002; a meta-analysis of 48 studies: Buhle et al. 2014). It is the area your band looks at.',
  'card.9': 'What you practise here. In the freeze your focus fills a ring of clarity. The band measures attention, not character and not prayer. You practise the pause where it is safe, like any skill: a little at a time, many times.',
  'card.10': 'Anger is not the enemy. It says something mattered: respect, time, the people you love, fairness. The aim is not to put it out but to answer from thought rather than reflex. Stepping away for a moment is a good answer too, if you come back to the conversation.',
  'card.src': 'Sources: Kross, Ayduk & Mischel 2005; Ayduk & Kross 2008, 2010; Mischkowski, Kross & Bushman 2012; Lieberman et al. 2007; Torre & Lieberman 2018; Gross 1998; Ochsner et al. 2002; Buhle et al. 2014; Zaccaro et al. 2018; Verduyn et al. 2009; Bushman et al. 2005; Denson 2013; Arnsten 2009.',
  'card.not': 'This is attention training, not therapy. If there is violence at home, or your anger frightens you or hurts the people close to you, don’t stay alone with it: talk to a psychologist or a doctor, or call.',
};

const de: Readonly<Record<string, string>> = {
  'open.1': 'Wut ist ein Signal: Etwas Wichtiges wurde verletzt. Du musst sie nicht unterdrücken. Du kannst sie anhalten, bevor sie für dich handelt.',
  'open.2': 'Du siehst gewöhnliche, schwierige Momente mit deinen eigenen Augen. Wenn alles zu kochen beginnt, bleibt die Zeit stehen: Standbild.',
  'open.3': 'Im Standbild trittst du zur Seite und siehst dich von außen. Du atmest langsam, benennst, was du fühlst, und schaust noch einmal hin.',
  'open.4': 'Deine Konzentration füllt einen Ring aus Klarheit. Das Stirnband misst Aufmerksamkeit, nicht Gebet. Du wählst die Antwort, wenn es klarer ist.',

  'card.title': 'Warum es wirkt',
  'card.1': 'Was in der Wut geschieht. Der Körper reagiert schneller als das Denken: Das Herz rast, die Muskeln spannen sich, der Atem wird flach. Ein alter Alarm, der dich schützen soll.',
  'card.2': 'Die erste Welle ist kurz. Wenn nichts sie nährt, ebbt sie im Körper meist nach ein, zwei Minuten ab. Länger hält die Wut, wenn du in Gedanken zum Geschehenen zurückkehrst: Jede Wiederholung gießt Öl ins Feuer (Verduyn u. a. 2009; Bushman u. a. 2005).',
  'card.3': 'Darum wirkt eine Pause. Starker Stress lockert den Griff des präfrontalen Kortex, des Teils des Gehirns, der dir hilft innezuhalten (Arnsten 2009). Ein paar ruhige Atemzüge geben ihm Zeit, den Alarm einzuholen.',
  'card.4': 'Schritt 1: der Blick von außen. Wenn du die Szene wie ein Außenstehender betrachtest, wie eine „Fliege an der Wand“, wird die Wut schwächer und Rachegedanken verstummen. Das zeigten Studien von Kross und Ayduk sowie von Mischkowski, Kross und Bushman (2012). Darum verlässt die Kamera im Standbild deine Augen.',
  'card.5': 'Schritt 2: langsamer Atem. Einatmen auf vier, ausatmen auf sechs. Langsamer als zehn Atemzüge pro Minute beruhigt das Herz und senkt die Erregung; in Studien fühlten sich Menschen danach weniger ängstlich und weniger wütend (Übersicht: Zaccaro u. a. 2018).',
  'card.6': 'Schritt 3: Benenne, was du fühlst. Schon das Wort „Wut“, „Kränkung“ oder „Scham“ dämpft das Alarmzentrum im Gehirn (den Mandelkern) und beschäftigt den präfrontalen Kortex (Lieberman u. a. 2007). Eine stille Art, ein Gefühl mit einem Wort zu ordnen (Torre & Lieberman 2018).',
  'card.7': 'Schritt 4: der zweite Blick. Du fragst, was sonst noch wahr sein könnte und was in einer Woche zählt. Diese Neubewertung lindert das unangenehme Gefühl. Zähne zusammenbeißen und unterdrücken tut das nicht, die Anspannung im Körper steigt sogar (Gross 1998).',
  'card.8': 'Der präfrontale Kortex hält die Zügel. Wenn du ein Gefühl benennst oder noch einmal hinschaust, arbeitet der präfrontale Kortex und das Alarmzentrum wird ruhiger (Ochsner u. a. 2002; Metaanalyse von 48 Studien: Buhle u. a. 2014). Genau diesen Bereich beobachtet dein Stirnband.',
  'card.9': 'Was du hier übst. Im Standbild füllt deine Konzentration einen Ring aus Klarheit. Das Stirnband misst Aufmerksamkeit, nicht Charakter und nicht Gebet. Die Pause übst du dort, wo es sicher ist, wie jede Fähigkeit: Stück für Stück und viele Male.',
  'card.10': 'Wut ist kein Feind. Sie sagt, dass etwas wichtig war: Respekt, Zeit, deine Nächsten, Gerechtigkeit. Es geht nicht darum, sie zu löschen, sondern aus Überlegung zu antworten statt aus Reflex. Kurz wegzugehen ist auch eine gute Antwort, wenn du danach ins Gespräch zurückkehrst.',
  'card.src': 'Quellen: Kross, Ayduk & Mischel 2005; Ayduk & Kross 2008, 2010; Mischkowski, Kross & Bushman 2012; Lieberman u. a. 2007; Torre & Lieberman 2018; Gross 1998; Ochsner u. a. 2002; Buhle u. a. 2014; Zaccaro u. a. 2018; Verduyn u. a. 2009; Bushman u. a. 2005; Denson 2013; Arnsten 2009.',
  'card.not': 'Das ist Aufmerksamkeitstraining, keine Therapie. Wenn es zu Hause Gewalt gibt oder deine Wut dir Angst macht oder deine Nächsten verletzt, bleib damit nicht allein: Sprich mit einer Psychologin, einem Arzt oder ruf an.',
};

const sv: Readonly<Record<string, string>> = {
  'open.1': 'Ilska är en signal: något viktigt har kränkts. Du behöver inte trycka undan den. Du kan stoppa den innan den handlar åt dig.',
  'open.2': 'Du ser vanliga, svåra stunder med dina egna ögon. När allt börjar koka stannar tiden: en frysbild.',
  'open.3': 'I frysbilden tar du ett steg åt sidan och ser dig själv utifrån. Du andas långsamt, sätter ord på det du känner och tittar en gång till.',
  'open.4': 'Ditt fokus fyller en ring av klarhet. Pannbandet mäter uppmärksamhet, inte bön. Du väljer ditt svar när det har klarnat.',

  'card.title': 'Varför det fungerar',
  'card.1': 'Vad som händer i ilska. Kroppen reagerar snabbare än tanken: hjärtat slår fortare, musklerna spänns, andningen blir ytlig. Det är ett gammalt larm som ska skydda dig.',
  'card.2': 'Den första vågen är kort. Om inget när den ebbar den i kroppen oftast ut på en minut eller två. Ilskan varar längre när du går tillbaka i tankarna till det som hände: varje repris häller bensin på elden (Verduyn m.fl. 2009; Bushman m.fl. 2005).',
  'card.3': 'Därför fungerar en paus. Stark stress lossar greppet för den prefrontala barken, den del av hjärnan som hjälper dig att stanna upp (Arnsten 2009). Några lugna andetag ger den tid att hinna ikapp larmet.',
  'card.4': 'Steg 1: blicken utifrån. När du ser scenen som en utomstående, som en ”fluga på väggen”, försvagas ilskan och hämndtankarna tystnar. Det visade studier av Kross och Ayduk och av Mischkowski, Kross och Bushman (2012). Därför lämnar kameran dina ögon i frysbilden.',
  'card.5': 'Steg 2: långsam andning. In på fyra, ut på sex. Att andas långsammare än tio andetag i minuten lugnar hjärtat och sänker påslaget; i studier kände sig människor mindre oroliga och mindre arga efteråt (översikt: Zaccaro m.fl. 2018).',
  'card.6': 'Steg 3: sätt ord på det du känner. Bara ordet ”ilska”, ”sårad” eller ”skam” dämpar hjärnans larmcentrum (amygdala) och sätter den prefrontala barken i arbete (Lieberman m.fl. 2007). Ett tyst sätt att ordna en känsla med ett ord (Torre & Lieberman 2018).',
  'card.7': 'Steg 4: en andra blick. Du frågar vad mer som kan vara sant och vad som spelar roll om en vecka. En sådan omvärdering lindrar den obehagliga känslan. Att bita ihop och trycka undan gör inte det, och spänningen i kroppen ökar till och med (Gross 1998).',
  'card.8': 'Den prefrontala barken håller i tyglarna. När du sätter ord på en känsla eller tittar en gång till arbetar den prefrontala barken och larmcentrumet lugnar sig (Ochsner m.fl. 2002; metaanalys av 48 studier: Buhle m.fl. 2014). Det är det området ditt pannband tittar på.',
  'card.9': 'Det här övar du. I frysbilden fyller ditt fokus en ring av klarhet. Pannbandet mäter uppmärksamhet, inte karaktär och inte bön. Pausen övar du där det är tryggt, som varje färdighet: lite i taget och många gånger.',
  'card.10': 'Ilskan är ingen fiende. Den säger att något var viktigt: respekt, tid, dina närmaste, rättvisa. Målet är inte att släcka den, utan att svara med eftertanke i stället för reflex. Att gå undan en stund är också ett bra svar, om du sedan kommer tillbaka till samtalet.',
  'card.src': 'Källor: Kross, Ayduk & Mischel 2005; Ayduk & Kross 2008, 2010; Mischkowski, Kross & Bushman 2012; Lieberman m.fl. 2007; Torre & Lieberman 2018; Gross 1998; Ochsner m.fl. 2002; Buhle m.fl. 2014; Zaccaro m.fl. 2018; Verduyn m.fl. 2009; Bushman m.fl. 2005; Denson 2013; Arnsten 2009.',
  'card.not': 'Det här är träning av uppmärksamhet, inte terapi. Om det finns våld i hemmet, eller om din ilska skrämmer dig eller sårar dina närmaste, stanna inte ensam med det: prata med en psykolog eller läkare, eller ring.',
};

export const WHY: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { pl, en, de, sv };
