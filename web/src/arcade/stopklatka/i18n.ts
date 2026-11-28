/**
 * Stop-klatka's own words in Polish (the source), English, German and Swedish (src/i18n): the feelings, the freeze's
 * steps, the step away, the cards of the opening and the close, what the band asks now, the coach marks, the summary
 * and the lobby's card.  The stories' words are in `stories-<age>*.ts`, the "why" in why.ts.
 *
 * The heart series' words (§18.3): light pictures attention, never grace; the prayer has a Thou; no promise of healing;
 * the band measures attention.  Polish capitalises the address to the player ("Ty", "Twoje") as the series does and
 * never genders the player (present tense, nouns, neutral constructions: a test holds it); German and Swedish say "du";
 * a no-break space keeps a number with its unit.  Quotation marks: pl „…”, de „…“, sv ”…”, en “…”.
 */
import { format, lang, pick, translator } from '../../i18n';

const N = ' ';

const pl = {
  // ── counts ──
  'moments': { one: `{n}${N}opanowana chwila`, few: `{n}${N}opanowane chwile`, many: `{n}${N}opanowanych chwil`, other: `{n}${N}opanowanej chwili` },
  'stories': { one: `{n}${N}historia`, few: `{n}${N}historie`, many: `{n}${N}historii`, other: `{n}${N}historii` },
  'sec': `{n}${N}s`,
  'pct': '{n}%',

  // ── the feelings (chips) ──
  'feel.anger': 'Złość',
  'feel.hurt': 'Zranienie',
  'feel.fear': 'Lęk',
  'feel.shame': 'Wstyd',
  'feel.helpless': 'Bezradność',
  'feel.envy': 'Zazdrość',
  'feel.tired': 'Zmęczenie',
  'feel.disgust': 'Niesmak',

  // ── the age groups ──
  'age.label': 'Grupa wieku {span}',

  // ── the freeze's steps ──
  'step.stop': 'Stop',
  'step.breathe': 'Oddech',
  'step.name': 'Nazwij',
  'step.second': 'Drugie spojrzenie',
  'step.choose': 'Wybór',
  'fz.stop': 'Czas stanął.',
  'fz.urge': 'Pierwszy odruch: {urge}',
  'fz.see': 'Zobacz siebie z boku. Jesteś tu, teraz.',
  'fz.breathe': 'Wdech 4 · wydech 6. Skupienie ładuje jasność.',
  'fz.nameQ': 'Co czujesz?',
  'fz.named': 'Nazwane: {f}',
  'fz.namedFor': 'Może to: {f}',
  'fz.secondQ': 'Spójrz jeszcze raz',
  'fz.chooseQ': 'Co zrobisz, gdy czas ruszy?',
  'fz.calm': 'Odpowiem ze spokoju',
  'fz.away': 'Odejdę na chwilę',
  'fz.other': 'Tym razem — druga droga',
  'fz.charged': 'Jasność pełna',
  'fz.hold': 'Trwaj w jasności — czas zaraz ruszy.',
  'fz.notYet': 'Czas rusza. Ta chwila też uczy.',

  // ── the step away (the second way: both are good) ──
  'away.text': 'Odchodzisz kilka kroków. Trzy wolne oddechy, ramiona w dół. Potem wracasz.',
  'away.say': 'Potrzebuję chwili. Zaraz wrócę.',
  'lesson.head': 'Na dzień',

  // ── the opening and the close ──
  'intro.title': 'Stop-klatka',
  'intro.group': 'Historie dla grupy {span}',
  'intro.first': 'Za chwilę pierwsza historia. Patrzysz własnymi oczami.',
  'ask.title': 'Twoja grupa wieku',
  'ask.note': 'Historie są z codzienności tej grupy. Zmienisz to w „Postępach”.',
  'ask.def': 'Bez wyboru: {span}',
  'ask.chosen': 'Dobrze — historie dla grupy {span}.',
  'close.title': 'Na dziś',
  'close.named': 'Nazwane: {list}',
  'close.noneNamed': 'Dziś nic nie zostało nazwane — następnym razem.',
  'close.lessons': 'Do zabrania w dzień',
  'close.prayer': 'Ojcze, oddaję Ci to, co dziś we mnie wrze. Przez Jezusa proszę o spokojne serce i jasne słowa, w Duchu Świętym.',

  // ── what the band asks now (the Mendi panel, the dock) ──
  'task.intro': 'Rozgość się — za chwilę pierwsza historia',
  'task.ask': 'Wybierz swoją grupę wieku',
  'task.tell': 'Odpocznij i czytaj — patrzysz własnymi oczami',
  'task.lead': 'Stop — czas stanął',
  'task.freeze': 'Skup uwagę — skupienie ładuje jasność',
  'task.charged': 'Trwaj w jasności',
  'task.after': 'Odpocznij — czas znów płynie',
  'task.lesson': 'Odpocznij — całe oddechy',
  'task.close': 'Na dziś wystarczy',

  // ── the headline's second line ──
  'sub.story': 'Historia {n}',
  'sub.freeze': 'Stop-klatka',
  'sub.best': 'Do rekordu: {n}',
  'sub.end': 'Koniec',

  // ── coach marks ──
  'coach.tap': 'Stuknij, by czytać dalej',
  'coach.click': 'Kliknij albo Spacja — czytaj dalej',
  'coach.focus': 'Patrz na siebie z boku i skup uwagę — pierścień jasności się napełnia',
  'coach.name': 'Stuknij uczucie, które pasuje',
  'coach.nameClick': 'Kliknij uczucie, które pasuje (albo 1–4)',
  'coach.choose': 'Stuknij, co zrobisz, gdy czas ruszy',
  'coach.chooseClick': 'Kliknij, co zrobisz, gdy czas ruszy (albo 1–2)',

  // ── the summary ──
  'stat.mastered': 'Opanowane chwile',
  'stat.of': '{n} z {of}',
  'stat.held': 'Jasność utrzymana',
  'stat.group': 'Grupa',
  'stat.contrast': 'Kontrast skupienia',
  'hl.all': 'Każda stop-klatka naładowana jasnością.',
  'hl.named': 'Nazwane uczucia: {list}',
  'hl.lesson': 'Na dzień: {lesson}',
  'hl.held': 'Jasność utrzymana po naładowaniu: {t}',
  'hl.record': 'Nowy rekord opanowanych chwil.',
  'hl.quiet': 'Jasność tym razem nie zdążyła — każda stop-klatka i tak uczy.',

  // ── the lobby's card ──
  'panel.mastered': 'Opanowane chwile',
  'panel.best': 'Najwięcej w sesji',
  'panel.told': 'Historie',
  'panel.age': 'Twoja grupa wieku',
  'panel.ageNote': 'Historie są z codzienności tej grupy: szkoła, praca, dom, kolejki, ekran.',
  'panel.ageAsk': 'Wybierz grupę. Jeśli nie wybierzesz, pierwsza sesja zapyta o nią na początku.',
  'panel.next': 'Następna historia: „{title}”',
  'panel.fc': `Sesja {min}${N}min: {stories}, stop-klatka ok. {f}${N}s.`,
  'panel.heavy': 'Także trudniejsze sytuacje',
  'panel.heavyNote': 'Np. wykluczenie, czyjaś choroba, bardzo ciężka rozmowa. Wyłączone, dopóki ich nie włączysz.',
  'panel.heavyNone': 'W tej grupie nie ma trudniejszych historii.',
  'panel.on': 'Tak',
  'panel.off': 'Nie',
  'panel.named': 'Najczęściej nazywane: {list}',
  'panel.why': 'Dlaczego to działa',
  'panel.help': 'Gdy złość przeraża Ciebie albo innych, gdy w domu jest przemoc: porozmawiaj z kimś. 116 111 — dzieci i młodzież, 116 123 — dorośli, Niebieska Linia 800 120 002, w nagłej sytuacji 112.',
  'panel.not': 'To trening uwagi i wyobraźni, nie terapia.',

  // ── the rhythm (kit/rhythm.ts) ──
  'rhythm.focus': 'Stop-klatka',
  'rhythm.rest': 'Oddechy po historii',
  'rhythm.note': 'Stop-klatka trwa tyle sekund skupienia; po każdej historii lekcja i całe oddechy. Bez zmiany pokręteł obie rosną z długością sesji i Twoim doświadczeniem.',

  // ── how to play ──
  'howto.goal': 'Przeżyj codzienne sytuacje własnymi oczami, a w stop-klatce zatrzymaj czas, naładuj jasność skupieniem i wybierz odpowiedź ze spokoju.',
  'howto.tap': 'Stuknij — czytaj dalej; w stop-klatce stuknij uczucie i to, co zrobisz',
  'howto.click': 'Kliknij — czytaj dalej; w stop-klatce kliknij uczucie i to, co zrobisz',
  'howto.keys': 'Spacja — dalej; 1–4 — wybór',
  'howto.tip1': 'W stop-klatce patrz na siebie z boku i oddychaj: wdech 4, wydech 6.',
  'howto.tip2': 'Złość jest sygnałem, że coś jest ważne. Tu uczysz się ją usłyszeć, zanim zacznie mówić za Ciebie.',
};

export type Key = keyof typeof pl;
type Cat = { readonly [K in Key]: string | { one: string; few?: string; many?: string; other: string } };

const en: Cat = {
  'moments': { one: `{n}${N}moment mastered`, other: `{n}${N}moments mastered` },
  'stories': { one: `{n}${N}story`, other: `{n}${N}stories` },
  'sec': `{n}${N}s`,
  'pct': '{n}%',

  'feel.anger': 'Anger',
  'feel.hurt': 'Hurt',
  'feel.fear': 'Fear',
  'feel.shame': 'Shame',
  'feel.helpless': 'Helpless',
  'feel.envy': 'Envy',
  'feel.tired': 'Worn out',
  'feel.disgust': 'Disgust',

  'age.label': 'Age group {span}',

  'step.stop': 'Stop',
  'step.breathe': 'Breathe',
  'step.name': 'Name it',
  'step.second': 'A second look',
  'step.choose': 'Choose',
  'fz.stop': 'Time has stopped.',
  'fz.urge': 'First impulse: {urge}',
  'fz.see': 'See yourself from the side. You are here, now.',
  'fz.breathe': 'In for 4 · out for 6. Your focus charges the clarity.',
  'fz.nameQ': 'What do you feel?',
  'fz.named': 'Named: {f}',
  'fz.namedFor': 'Maybe this: {f}',
  'fz.secondQ': 'Look again',
  'fz.chooseQ': 'What will you do when time moves on?',
  'fz.calm': 'Answer from the calm',
  'fz.away': 'Step away for a moment',
  'fz.other': 'This time — the other way',
  'fz.charged': 'Full clarity',
  'fz.hold': 'Stay in the clarity — time is about to move.',
  'fz.notYet': 'Time moves on. This moment teaches too.',

  'away.text': 'You walk a few steps away. Three slow breaths, shoulders down. Then you come back.',
  'away.say': 'I need a moment. I’ll be right back.',
  'lesson.head': 'For the day',

  'intro.title': 'Freeze Frame',
  'intro.group': 'Stories for ages {span}',
  'intro.first': 'The first story is coming. You see it through your own eyes.',
  'ask.title': 'Your age group',
  'ask.note': 'The stories come from this group’s everyday life. You can change it under “Progress”.',
  'ask.def': 'If you don’t choose: {span}',
  'ask.chosen': 'Good — stories for ages {span}.',
  'close.title': 'For today',
  'close.named': 'Named: {list}',
  'close.noneNamed': 'Nothing was named today — next time.',
  'close.lessons': 'To take into the day',
  'close.prayer': 'Father, I give You what is boiling in me today. Through Jesus I ask for a calm heart and clear words, in the Holy Spirit.',

  'task.intro': 'Settle in — the first story is coming',
  'task.ask': 'Choose your age group',
  'task.tell': 'Rest and read — you see through your own eyes',
  'task.lead': 'Stop — time has stopped',
  'task.freeze': 'Focus — your focus charges the clarity',
  'task.charged': 'Stay in the clarity',
  'task.after': 'Rest — time flows again',
  'task.lesson': 'Rest — whole breaths',
  'task.close': 'That’s enough for today',

  'sub.story': 'Story {n}',
  'sub.freeze': 'Freeze frame',
  'sub.best': 'To your record: {n}',
  'sub.end': 'The end',

  'coach.tap': 'Tap to read on',
  'coach.click': 'Click or press Space to read on',
  'coach.focus': 'Look at yourself from the side and focus — the ring of clarity fills',
  'coach.name': 'Tap the feeling that fits',
  'coach.nameClick': 'Click the feeling that fits (or 1–4)',
  'coach.choose': 'Tap what you will do when time moves on',
  'coach.chooseClick': 'Click what you will do when time moves on (or 1–2)',

  'stat.mastered': 'Moments mastered',
  'stat.of': '{n} of {of}',
  'stat.held': 'Clarity held',
  'stat.group': 'Group',
  'stat.contrast': 'Focus contrast',
  'hl.all': 'Every freeze frame charged with clarity.',
  'hl.named': 'Feelings named: {list}',
  'hl.lesson': 'For the day: {lesson}',
  'hl.held': 'Clarity held after the charge: {t}',
  'hl.record': 'A new record of moments mastered.',
  'hl.quiet': 'The clarity didn’t fill this time — every freeze frame still teaches.',

  'panel.mastered': 'Moments mastered',
  'panel.best': 'Most in a session',
  'panel.told': 'Stories',
  'panel.age': 'Your age group',
  'panel.ageNote': 'The stories come from this group’s everyday life: school, work, home, queues, screens.',
  'panel.ageAsk': 'Choose a group. If you don’t, your first session will ask at the start.',
  'panel.next': 'Next story: “{title}”',
  'panel.fc': `A {min}${N}min session: {stories}, a freeze frame of about {f}${N}s.`,
  'panel.heavy': 'Harder situations too',
  'panel.heavyNote': 'E.g. being left out, someone’s illness, a very hard conversation. Off until you switch them on.',
  'panel.heavyNone': 'This group has no harder stories.',
  'panel.on': 'Yes',
  'panel.off': 'No',
  'panel.named': 'Named most often: {list}',
  'panel.why': 'Why it works',
  'panel.help': 'If anger frightens you or others, or there is violence at home, talk to someone: 116 111 for children and young people in much of Europe (Childline 0800 1111 in the UK), Samaritans 116 123 (UK and Ireland), 988 (US), and your emergency number.',
  'panel.not': 'This is attention and imagination training, not therapy.',

  'rhythm.focus': 'Freeze frame',
  'rhythm.rest': 'Breaths after a story',
  'rhythm.note': 'The freeze frame lasts this many seconds of focus; after each story comes its lesson and whole breaths. Left as they are, both grow with the session’s length and your experience.',

  'howto.goal': 'Live everyday moments through your own eyes — and in the freeze frame stop time, charge the clarity with your focus and choose an answer from the calm.',
  'howto.tap': 'Tap to read on; in the freeze frame, tap the feeling and what you will do',
  'howto.click': 'Click to read on; in the freeze frame, click the feeling and what you will do',
  'howto.keys': 'Space — next; 1–4 — choose',
  'howto.tip1': 'In the freeze frame, look at yourself from the side and breathe: in for 4, out for 6.',
  'howto.tip2': 'Anger is a signal that something matters. Here you learn to hear it before it starts speaking for you.',
};

const de: Cat = {
  'moments': { one: `{n}${N}gemeisterter Moment`, other: `{n}${N}gemeisterte Momente` },
  'stories': { one: `{n}${N}Geschichte`, other: `{n}${N}Geschichten` },
  'sec': `{n}${N}s`,
  'pct': `{n}${N}%`,

  'feel.anger': 'Wut',
  'feel.hurt': 'Kränkung',
  'feel.fear': 'Angst',
  'feel.shame': 'Scham',
  'feel.helpless': 'Hilflosigkeit',
  'feel.envy': 'Neid',
  'feel.tired': 'Erschöpfung',
  'feel.disgust': 'Ekel',

  'age.label': 'Altersgruppe {span}',

  'step.stop': 'Stopp',
  'step.breathe': 'Atem',
  'step.name': 'Benennen',
  'step.second': 'Zweiter Blick',
  'step.choose': 'Wahl',
  'fz.stop': 'Die Zeit steht still.',
  'fz.urge': 'Erster Impuls: {urge}',
  'fz.see': 'Sieh dich von der Seite. Du bist hier, jetzt.',
  'fz.breathe': 'Ein 4 · aus 6. Deine Konzentration lädt die Klarheit.',
  'fz.nameQ': 'Was fühlst du?',
  'fz.named': 'Benannt: {f}',
  'fz.namedFor': 'Vielleicht: {f}',
  'fz.secondQ': 'Schau noch einmal hin',
  'fz.chooseQ': 'Was tust du, wenn die Zeit weiterläuft?',
  'fz.calm': 'Aus der Ruhe antworten',
  'fz.away': 'Kurz weggehen',
  'fz.other': 'Diesmal — der andere Weg',
  'fz.charged': 'Volle Klarheit',
  'fz.hold': 'Bleib in der Klarheit — gleich läuft die Zeit weiter.',
  'fz.notYet': 'Die Zeit läuft weiter. Auch dieser Moment lehrt.',

  'away.text': 'Du gehst ein paar Schritte weg. Drei langsame Atemzüge, Schultern runter. Dann kommst du zurück.',
  'away.say': 'Ich brauche einen Moment. Bin gleich wieder da.',
  'lesson.head': 'Für den Tag',

  'intro.title': 'Standbild',
  'intro.group': 'Geschichten für {span}',
  'intro.first': 'Gleich kommt die erste Geschichte. Du siehst sie mit deinen eigenen Augen.',
  'ask.title': 'Deine Altersgruppe',
  'ask.note': 'Die Geschichten kommen aus dem Alltag dieser Gruppe. Ändern kannst du das unter „Fortschritt“.',
  'ask.def': 'Ohne Wahl: {span}',
  'ask.chosen': 'Gut — Geschichten für {span}.',
  'close.title': 'Für heute',
  'close.named': 'Benannt: {list}',
  'close.noneNamed': 'Heute wurde nichts benannt — beim nächsten Mal.',
  'close.lessons': 'Für den Tag',
  'close.prayer': 'Vater, ich gebe dir, was heute in mir kocht. Durch Jesus bitte ich um ein ruhiges Herz und klare Worte, im Heiligen Geist.',

  'task.intro': 'Komm an — gleich kommt die erste Geschichte',
  'task.ask': 'Wähle deine Altersgruppe',
  'task.tell': 'Ruh dich aus und lies — du siehst mit deinen eigenen Augen',
  'task.lead': 'Stopp — die Zeit steht still',
  'task.freeze': 'Konzentrier dich — die Konzentration lädt die Klarheit',
  'task.charged': 'Bleib in der Klarheit',
  'task.after': 'Ruh dich aus — die Zeit fließt wieder',
  'task.lesson': 'Ruh dich aus — ganze Atemzüge',
  'task.close': 'Für heute genug',

  'sub.story': 'Geschichte {n}',
  'sub.freeze': 'Standbild',
  'sub.best': 'Bis zum Rekord: {n}',
  'sub.end': 'Ende',

  'coach.tap': 'Tippe, um weiterzulesen',
  'coach.click': 'Klick oder Leertaste — weiterlesen',
  'coach.focus': 'Sieh dich von der Seite und konzentrier dich — der Ring der Klarheit füllt sich',
  'coach.name': 'Tippe auf das Gefühl, das passt',
  'coach.nameClick': 'Klick auf das Gefühl, das passt (oder 1–4)',
  'coach.choose': 'Tippe, was du tust, wenn die Zeit weiterläuft',
  'coach.chooseClick': 'Klick, was du tust, wenn die Zeit weiterläuft (oder 1–2)',

  'stat.mastered': 'Gemeisterte Momente',
  'stat.of': '{n} von {of}',
  'stat.held': 'Gehaltene Klarheit',
  'stat.group': 'Gruppe',
  'stat.contrast': 'Konzentrationskontrast',
  'hl.all': 'Jedes Standbild mit Klarheit geladen.',
  'hl.named': 'Benannte Gefühle: {list}',
  'hl.lesson': 'Für den Tag: {lesson}',
  'hl.held': 'Klarheit nach dem Laden gehalten: {t}',
  'hl.record': 'Ein neuer Rekord gemeisterter Momente.',
  'hl.quiet': 'Die Klarheit hat sich diesmal nicht gefüllt — jedes Standbild lehrt trotzdem.',

  'panel.mastered': 'Gemeisterte Momente',
  'panel.best': 'Die meisten in einer Sitzung',
  'panel.told': 'Geschichten',
  'panel.age': 'Deine Altersgruppe',
  'panel.ageNote': 'Die Geschichten kommen aus dem Alltag dieser Gruppe: Schule, Arbeit, Zuhause, Warteschlangen, Bildschirm.',
  'panel.ageAsk': 'Wähle eine Gruppe. Sonst fragt die erste Sitzung am Anfang danach.',
  'panel.next': 'Nächste Geschichte: „{title}“',
  'panel.fc': `Eine Sitzung von {min}${N}min: {stories}, ein Standbild von etwa {f}${N}s.`,
  'panel.heavy': 'Auch schwerere Situationen',
  'panel.heavyNote': 'Z. B. ausgeschlossen werden, die Krankheit eines Menschen, ein sehr schweres Gespräch. Aus, bis du sie einschaltest.',
  'panel.heavyNone': 'In dieser Gruppe gibt es keine schwereren Geschichten.',
  'panel.on': 'Ja',
  'panel.off': 'Nein',
  'panel.named': 'Am häufigsten benannt: {list}',
  'panel.why': 'Warum es wirkt',
  'panel.help': 'Wenn die Wut dir oder anderen Angst macht oder es zu Hause Gewalt gibt, sprich mit jemandem: Nummer gegen Kummer 116 111 (Kinder und Jugendliche), TelefonSeelsorge 0800 111 0 111, im Notfall 112.',
  'panel.not': 'Das ist Training von Aufmerksamkeit und Vorstellungskraft, keine Therapie.',

  'rhythm.focus': 'Standbild',
  'rhythm.rest': 'Atemzüge nach einer Geschichte',
  'rhythm.note': 'Das Standbild dauert so viele Sekunden Konzentration; nach jeder Geschichte kommen ihre Lehre und ganze Atemzüge. Unverändert wachsen beide mit der Länge der Sitzung und deiner Erfahrung.',

  'howto.goal': 'Erlebe Alltagsmomente mit deinen eigenen Augen — und halte im Standbild die Zeit an, lade die Klarheit mit Konzentration und wähle eine Antwort aus der Ruhe.',
  'howto.tap': 'Tippe — weiterlesen; im Standbild tippst du auf das Gefühl und auf das, was du tust',
  'howto.click': 'Klick — weiterlesen; im Standbild klickst du auf das Gefühl und auf das, was du tust',
  'howto.keys': 'Leertaste — weiter; 1–4 — wählen',
  'howto.tip1': 'Sieh dich im Standbild von der Seite und atme: ein 4, aus 6.',
  'howto.tip2': 'Wut ist ein Zeichen, dass dir etwas wichtig ist. Hier lernst du, sie zu hören, bevor sie für dich spricht.',
};

const sv: Cat = {
  'moments': { one: `{n}${N}bemästrat ögonblick`, other: `{n}${N}bemästrade ögonblick` },
  'stories': { one: `{n}${N}berättelse`, other: `{n}${N}berättelser` },
  'sec': `{n}${N}s`,
  'pct': `{n}${N}%`,

  'feel.anger': 'Ilska',
  'feel.hurt': 'Sårad',
  'feel.fear': 'Rädsla',
  'feel.shame': 'Skam',
  'feel.helpless': 'Maktlöshet',
  'feel.envy': 'Avundsjuka',
  'feel.tired': 'Trötthet',
  'feel.disgust': 'Avsmak',

  'age.label': 'Åldersgrupp {span}',

  'step.stop': 'Stopp',
  'step.breathe': 'Andning',
  'step.name': 'Sätt ord',
  'step.second': 'En andra blick',
  'step.choose': 'Val',
  'fz.stop': 'Tiden har stannat.',
  'fz.urge': 'Första impulsen: {urge}',
  'fz.see': 'Se dig själv från sidan. Du är här, nu.',
  'fz.breathe': 'In 4 · ut 6. Ditt fokus laddar klarheten.',
  'fz.nameQ': 'Vad känner du?',
  'fz.named': 'Satt ord på: {f}',
  'fz.namedFor': 'Kanske: {f}',
  'fz.secondQ': 'Titta en gång till',
  'fz.chooseQ': 'Vad gör du när tiden går vidare?',
  'fz.calm': 'Svara ur lugnet',
  'fz.away': 'Gå undan en stund',
  'fz.other': 'Den här gången — den andra vägen',
  'fz.charged': 'Full klarhet',
  'fz.hold': 'Stanna i klarheten — snart går tiden vidare.',
  'fz.notYet': 'Tiden går vidare. Också det här ögonblicket lär.',

  'away.text': 'Du går några steg bort. Tre långsamma andetag, axlarna ner. Sedan kommer du tillbaka.',
  'away.say': 'Jag behöver en stund. Jag kommer strax.',
  'lesson.head': 'Till dagen',

  'intro.title': 'Frysbild',
  'intro.group': 'Berättelser för {span}',
  'intro.first': 'Snart kommer första berättelsen. Du ser den med dina egna ögon.',
  'ask.title': 'Din åldersgrupp',
  'ask.note': 'Berättelserna kommer från den här gruppens vardag. Du ändrar det under ”Framsteg”.',
  'ask.def': 'Utan val: {span}',
  'ask.chosen': 'Bra — berättelser för {span}.',
  'close.title': 'För i dag',
  'close.named': 'Satt ord på: {list}',
  'close.noneNamed': 'I dag fick inget ett namn — nästa gång.',
  'close.lessons': 'Att ta med in i dagen',
  'close.prayer': 'Fader, jag lämnar åt dig det som kokar i mig i dag. Genom Jesus ber jag om ett lugnt hjärta och klara ord, i den helige Ande.',

  'task.intro': 'Landa — snart kommer första berättelsen',
  'task.ask': 'Välj din åldersgrupp',
  'task.tell': 'Vila och läs — du ser med dina egna ögon',
  'task.lead': 'Stopp — tiden har stannat',
  'task.freeze': 'Fokusera — fokuset laddar klarheten',
  'task.charged': 'Stanna i klarheten',
  'task.after': 'Vila — tiden flyter igen',
  'task.lesson': 'Vila — hela andetag',
  'task.close': 'Det räcker för i dag',

  'sub.story': 'Berättelse {n}',
  'sub.freeze': 'Frysbild',
  'sub.best': 'Till rekordet: {n}',
  'sub.end': 'Slut',

  'coach.tap': 'Tryck för att läsa vidare',
  'coach.click': 'Klicka eller mellanslag — läs vidare',
  'coach.focus': 'Se dig själv från sidan och fokusera — klarhetens ring fylls',
  'coach.name': 'Tryck på känslan som passar',
  'coach.nameClick': 'Klicka på känslan som passar (eller 1–4)',
  'coach.choose': 'Tryck på vad du gör när tiden går vidare',
  'coach.chooseClick': 'Klicka på vad du gör när tiden går vidare (eller 1–2)',

  'stat.mastered': 'Bemästrade ögonblick',
  'stat.of': '{n} av {of}',
  'stat.held': 'Klarhet som hölls',
  'stat.group': 'Grupp',
  'stat.contrast': 'Fokuskontrast',
  'hl.all': 'Varje frysbild laddad med klarhet.',
  'hl.named': 'Känslor du satte ord på: {list}',
  'hl.lesson': 'Till dagen: {lesson}',
  'hl.held': 'Klarhet som hölls efter laddningen: {t}',
  'hl.record': 'Ett nytt rekord av bemästrade ögonblick.',
  'hl.quiet': 'Klarheten hann inte fyllas den här gången — varje frysbild lär ändå.',

  'panel.mastered': 'Bemästrade ögonblick',
  'panel.best': 'Flest i en session',
  'panel.told': 'Berättelser',
  'panel.age': 'Din åldersgrupp',
  'panel.ageNote': 'Berättelserna kommer från den här gruppens vardag: skola, jobb, hem, köer, skärmar.',
  'panel.ageAsk': 'Välj en grupp. Annars frågar den första sessionen om den i början.',
  'panel.next': 'Nästa berättelse: ”{title}”',
  'panel.fc': `En session på {min}${N}min: {stories}, en frysbild på omkring {f}${N}s.`,
  'panel.heavy': 'Också svårare situationer',
  'panel.heavyNote': 'T.ex. att bli utesluten, någons sjukdom, ett mycket svårt samtal. Avstängt tills du slår på det.',
  'panel.heavyNone': 'Den här gruppen har inga svårare berättelser.',
  'panel.on': 'Ja',
  'panel.off': 'Nej',
  'panel.named': 'Oftast satt ord på: {list}',
  'panel.why': 'Varför det fungerar',
  'panel.help': 'Om ilskan skrämmer dig eller andra, eller om det finns våld hemma, prata med någon: BRIS 116 111 (barn och unga), Mind Självmordslinjen 90101, i nödläge 112.',
  'panel.not': 'Det här är träning av uppmärksamhet och föreställningsförmåga, ingen terapi.',

  'rhythm.focus': 'Frysbild',
  'rhythm.rest': 'Andetag efter en berättelse',
  'rhythm.note': 'Frysbilden varar så många sekunder av fokus; efter varje berättelse kommer dess lärdom och hela andetag. Lämnar du reglagen som de är, växer båda med sessionens längd och din erfarenhet.',

  'howto.goal': 'Upplev vardagsstunder med dina egna ögon — och stoppa tiden i frysbilden, ladda klarheten med ditt fokus och välj ett svar ur lugnet.',
  'howto.tap': 'Tryck — läs vidare; i frysbilden trycker du på känslan och på vad du gör',
  'howto.click': 'Klicka — läs vidare; i frysbilden klickar du på känslan och på vad du gör',
  'howto.keys': 'Mellanslag — nästa; 1–4 — välj',
  'howto.tip1': 'Se dig själv från sidan i frysbilden och andas: in 4, ut 6.',
  'howto.tip2': 'Ilska är en signal om att något är viktigt. Här lär du dig att höra den innan den börjar tala för dig.',
};

export const CATALOGS = { pl, en, de, sv };
export const t = translator<Key>(CATALOGS);

/** A plural text without its number, for words set beside a number drawn on its own. */
export function bare(key: Key, n: number): string {
  return format(pick(CATALOGS[lang][key], n), { n: '' }).replace(/^[+\s ]+/, '').replace(/\s{2,}/g, ' ').trim();
}

/** The headline's unit for `n` moments: 1 opanowana chwila, 3 opanowane chwile, 5 opanowanych chwil. */
export const unit = (n: number): string => bare('moments', n);

/** A feeling's word inside a sentence: lowercase ("nazwane: złość"), but German keeps its nouns' capital. */
export const feelWord = (f: string): string => {
  const w = t(`feel.${f}` as Key);
  return lang === 'de' ? w : w.toLowerCase();
};

/** A list in the page's language: "złość, zranienie i lęk". */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  const and = { pl: ' i ', en: ' and ', de: ' und ', sv: ' och ' }[lang];
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
}
