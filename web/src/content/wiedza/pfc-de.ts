/** Der präfrontale Kortex — the article in German (from the Polish source, pfc-pl.ts; DESIGN.md §15). */
import type { Article } from './types';

const article: Article = {
  kicker: 'Artikel · Gehirn und Geist',
  title: 'Der präfrontale Kortex',
  lede: 'Direkt hinter der Stirn, über den Augenbrauen, liegt der präfrontale Kortex — der Teil des Gehirns, den dein Stirnband misst. Er hilft, ein Ziel im Kopf zu behalten, einen voreiligen Impuls zu bremsen, Gefühle zu beruhigen und andere Menschen zu verstehen. Hier liest du, was die Forschung über ihn weiß: verständlich und mit Quellen, vor allem aus Metaanalysen und systematischen Übersichten.',

  band: {
    title: 'Was dein Stirnband sieht',
    intro: 'Beide Stirnbänder blicken auf dasselbe Stück Gehirn — den vorderen präfrontalen Kortex unter der Stirn —, messen aber Verschiedenes.',
    fnirs: {
      title: 'Mendi · fNIRS',
      text: 'Es strahlt Nahinfrarotlicht in die Stirn und misst, wie viel davon zurückkommt. Daraus berechnet es Veränderungen von sauerstoffreichem (HbO) und sauerstoffarmem (HbR) Blut im Kortex direkt unter den Sensoren: im Stirnpol und im dorsolateralen präfrontalen Kortex. Arbeitet dieser Bereich stärker, strömt mehr sauerstoffreiches Blut hinein.',
    },
    eeg: {
      title: 'HALO · EEG',
      text: 'Elektroden an der Stirn (Fp1, Fp2) und am Hinterkopf nehmen winzige elektrische Spannungen auf — Rhythmen, die entstehen, wenn große Gruppen von Nervenzellen zusammenarbeiten. Das Stirnband sieht nicht in die Tiefe des Gehirns, nur das, was die Haut erreicht.',
    },
    points: [
      { text: 'fNIRS ist unschädlich, verträgt Bewegung und passt in ein Stirnband — deshalb kann man damit auch außerhalb des Labors messen, vom Säugling bis ins hohe Alter.', refs: ['pinti2020'] },
      { text: 'Aus dem zurückkommenden Licht werden Veränderungen von sauerstoffreichem und sauerstoffarmem Hämoglobin berechnet; die meisten Geräte auf dem Markt arbeiten mit Dauerlicht, so auch Mendi.', refs: ['scholkmann2014'] },
      { text: 'Manche Veränderungen im fNIRS-Signal stammen nicht von arbeitenden Nervenzellen, sondern aus anderen Vorgängen im Körper. Forschende nennen das falsch-positive Befunde und lernen, sie herauszufiltern.', refs: ['tachtsidis2016'] },
      { text: 'Im EEG wirkt der Theta-Rhythmus über der Stirnmitte wie ein Signal, dass Kontrolle gebraucht wird — das Gehirn „merkt“, dass es sich konzentrieren oder etwas korrigieren muss.', refs: ['cavanagh2014'] },
      { text: 'Die Alpha-Asymmetrie zwischen linker und rechter Stirnseite wird manchmal als Marker für Depression dargestellt. Eine Metaanalyse von 16 Studien zeigte jedoch, dass sie für eine Diagnose nicht taugt.', refs: ['vandervinne2017'] },
    ],
  },

  sections: [
    {
      id: 'what',
      title: 'Was der präfrontale Kortex ist',
      short: 'Der vordere Teil der Stirnlappen — ein Dirigent, der das Ziel festhält und die Arbeit des übrigen Gehirns lenkt.',
      body: [
        { text: 'Der präfrontale Kortex nimmt den vorderen Teil des Gehirns ein, hinter der Stirn und über den Augenhöhlen. Die Forschung unterteilt ihn in mehrere Bereiche: dorsolateral (seitlich an der Stirn, wichtig für Denken und Planen), ventromedial und orbitofrontal (über den Augen, wichtig für Werte und Gefühle), medial (wichtig, um sich selbst und andere zu verstehen) und den Stirnpol direkt hinter der Stirnmitte.', refs: [] },
        { text: 'Am besten beschreibt ihn das Wort „kognitive Kontrolle“: Gedanken und Handlungen folgen deinem Ziel und nicht dem, was gerade am lautesten ist. Der präfrontale Kortex hält ein Bild des Ziels bereit und zeigt anderen Teilen des Gehirns, welchen Weg ein Signal nehmen soll.', refs: ['miller2001'] },
        { text: 'Er arbeitet nie allein, sondern in Netzwerken mit dem Scheitellappen, dem Gyrus cinguli, der Inselrinde und tiefen Strukturen des Gehirns — und wie gut diese Netzwerke zusammenspielen, entscheidet darüber, ob wir uns leicht konzentrieren, umschalten oder ausruhen.', refs: ['niendam2012', 'menon2011'] },
      ],
      points: [
        { text: 'Die Theorie von Miller und Cohen: Kognitive Kontrolle heißt, dass der präfrontale Kortex aktiv Muster aufrechterhält, die für das Ziel und den Weg dorthin stehen — und diese lenken den Fluss der Signale anderswo im Gehirn.', refs: ['miller2001'] },
        { text: 'Studien an Menschen mit Schädigungen des präfrontalen Kortex zeigen, dass er für das Ordnen und Steuern zielgerichteten Verhaltens unverzichtbar ist — obwohl man ihn einst für unwichtig hielt.', refs: ['szczepanski2014'] },
        { text: 'Eine Metaanalyse von 193 Bildgebungsstudien (2832 gesunde Personen) fand ein gemeinsames Netzwerk — dorsolateraler präfrontaler Kortex, vorderer Gyrus cinguli und Scheitellappen —, das bei ganz verschiedenen Aufgaben mit Kontrollbedarf aktiv ist.', refs: ['niendam2012'] },
        { text: 'Bei Depression, Angst oder Demenz liegt das Problem oft darin, wie sich die Netzwerke des Gehirns an- und abschalten, nicht an einer einzigen „kaputten“ Stelle.', refs: ['menon2011'] },
      ],
      strength: 'strong',
      forYou: 'Wenn dein Stirnband die Arbeit des präfrontalen Kortex zeigt, siehst du einen Ausschnitt eines größeren Ganzen: das Signal eines Bereichs, der mit dem ganzen Gehirn zusammenarbeitet.',
      link: '#sygnal',
    },
    {
      id: 'executive',
      title: 'Denken, Arbeitsgedächtnis und Hemmung',
      short: 'Exekutive Funktionen — Informationen im Kopf behalten, einen Impuls stoppen, einen Plan ändern — beruhen auf einem Netzwerk mit dem präfrontalen Kortex im Zentrum.',
      body: [
        { text: 'Die Psychologie unterscheidet drei grundlegende exekutive Funktionen. Das Arbeitsgedächtnis hält Informationen im Kopf und arbeitet mit ihnen, etwa beim Kopfrechnen. Die Hemmung lässt uns nicht das Erstbeste tun und uns nicht ablenken. Die Flexibilität erlaubt, einen Plan zu ändern und etwas von einer anderen Seite zu sehen. Darauf bauen Planen, Problemlösen und logisches Denken auf.', refs: ['diamond2013'] },
        { text: 'Diese Fähigkeiten reagieren empfindlich auf den Alltag: Stress, Schlafmangel, Einsamkeit und Bewegungsmangel schwächen sie deutlich, Übung stärkt sie.', refs: ['diamond2013'] },
      ],
      points: [
        { text: 'Den Kern der exekutiven Funktionen bilden Hemmung, Arbeitsgedächtnis und Flexibilität. Mit ihnen können wir mit Ideen spielen, nachdenken, bevor wir handeln, neue Herausforderungen meistern, Versuchungen widerstehen und bei der Sache bleiben.', refs: ['diamond2013'] },
        { text: 'Eine Metaanalyse von 24 Studien mit der n-back-Aufgabe (einem klassischen Test des Arbeitsgedächtnisses): Sie aktiviert zuverlässig den dorsolateralen und ventrolateralen präfrontalen Kortex, die Stirnpole und den Scheitellappen.', refs: ['owen2005'] },
        { text: 'Die Hemmung stützt sich großenteils auf den rechten unteren Stirnlappen, der zusammen mit den Basalganglien wie eine Bremse wirkt — voll durchgetreten oder nur kurz, um innezuhalten.', refs: ['aron2014'] },
        { text: 'Verschiedene exekutive Funktionen teilen sich ein gemeinsames Kontrollnetzwerk, doch jede bringt auch eigene Bereiche mit.', refs: ['niendam2012'] },
      ],
      strength: 'strong',
      forYou: 'Wenn etwas „nicht in den Kopf will“, gib nicht gleich dem schwachen Willen die Schuld — prüf zuerst Schlaf, Stress und Bewegung. Sie verändern die exekutiven Funktionen am schnellsten.',
      link: '#gry',
    },
    {
      id: 'attention',
      title: 'Aufmerksamkeit und lange Konzentration',
      short: 'Aufmerksamkeit über viele Minuten zu halten, fällt allen schwer, besonders bei einer einfachen, eintönigen Aufgabe. Dabei hilft vor allem ein rechtsseitiges Netzwerk mit dem präfrontalen Kortex.',
      body: [
        { text: 'Jeder kennt den Moment, in dem man denselben Absatz zum dritten Mal liest. Die Fähigkeit, bei einer Aufgabe zu bleiben, lässt mit der Zeit nach — und überraschenderweise schneller bei einfachen, sich wiederholenden Aufgaben.', refs: ['langner2013'] },
        { text: 'Anhaltende Aufmerksamkeit ist nicht ein Vorgang, sondern zwei ineinander verwobene: das stetige Festhalten an der Aufgabe und kurze, schnelle Rückkehr zu ihr, wenn uns etwas herausreißt.', refs: ['langner2013'] },
        { text: 'Gedankenwandern heißt nicht, dass das Gehirn „abschaltet“. Wenn die Gedanken abschweifen, arbeitet das Ruhezustandsnetzwerk (mit dem medialen präfrontalen Kortex) — aber ebenso beständig auch Kontrollbereiche im vorderen präfrontalen Kortex.', refs: ['fox2015'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von Bildgebungsstudien zur Wachsamkeit: Der Kern des Netzwerks für anhaltende Aufmerksamkeit liegt überwiegend rechts — im dorsomedialen, mittleren und ventrolateralen präfrontalen Kortex, der vorderen Inselrinde, dem Scheitellappen und subkortikalen Strukturen.', refs: ['langner2013'] },
        { text: 'Dass die Leistung mit der Dauer einer Aufgabe nachlässt, ist die Regel, nicht die Ausnahme — ein bekannter Effekt, der alle betrifft.', refs: ['langner2013'] },
        { text: 'Eine Metaanalyse von 24 Studien zum Gedankenwandern: Neben dem Ruhezustandsnetzwerk (medialer präfrontaler Kortex, hinterer Gyrus cinguli) sind ebenso beständig Kontrollbereiche aktiv — darunter der rostrolaterale präfrontale Kortex und der dorsale vordere Gyrus cinguli.', refs: ['fox2015'] },
      ],
      strength: 'strong',
      forYou: 'Abschweifende Gedanken sind kein Versagen. Im Training zählt die sanfte Rückkehr — und jede solche Rückkehr ist genau die Übung, die dein Stirnband sieht.',
      link: '#trening/focus',
    },
    {
      id: 'emotion',
      title: 'Gefühle und wie wir sie regulieren',
      short: 'Der präfrontale Kortex schaltet Gefühle nicht ab, aber er hilft, sie klüger zu durchleben — indem er die Aufmerksamkeit lenkt oder die Bedeutung einer Situation verändert.',
      body: [
        { text: 'Gefühle entstehen an vielen Orten im Gehirn, auch tief unter der Rinde — etwa im Mandelkern (Amygdala). Der präfrontale Kortex und der Gyrus cinguli können diese Reaktion dämpfen.', refs: ['ochsner2005', 'buhle2014'] },
        { text: 'Zwei Wege sind am besten erforscht: die Aufmerksamkeit woandershin lenken oder anders über die Situation denken. Den zweiten nennt die Psychologie Neubewertung — zum Beispiel: „Er ist nicht unhöflich, er hat einfach einen schlechten Tag.“', refs: ['ochsner2005', 'buhle2014'] },
        { text: 'Neubewertung nimmt Kontrollbereiche im Stirn- und Scheitellappen in Anspruch und beruhigt dadurch den Mandelkern.', refs: ['buhle2014'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 48 Studien: Neubewertung aktivierte durchgehend Bereiche der kognitiven Kontrolle und den seitlichen Schläfenlappen und veränderte die Aktivität des Mandelkerns auf beiden Seiten.', refs: ['buhle2014'] },
        { text: 'Der Schluss der Autoren: Kognitive Kontrolle verändert die Bedeutung dessen, was wir sehen — und erst diese neue Bedeutung beruhigt den Mandelkern.', refs: ['buhle2014'] },
        { text: 'Eine weitere Metaanalyse (23 Studien, 479 Personen) schlägt eine Rollenteilung vor: Der dorsolaterale präfrontale Kortex lenkt die Aufmerksamkeit, der ventrolaterale meldet, dass etwas reguliert werden muss, und der mittlere Teil des Gyrus cinguli führt das zusammen.', refs: ['kohn2014'] },
        { text: 'Beide Wege — Aufmerksamkeit lenken und Bedeutung verändern — beruhen auf dem Zusammenspiel präfrontaler Kontrollsysteme mit den Systemen, die Gefühle erzeugen.', refs: ['ochsner2005'] },
      ],
      strength: 'strong',
      forYou: 'Wenn ein Gefühl stark ist, versuch die Situation von einer anderen Seite zu sehen oder deine Aufmerksamkeit bewusst zu verlagern. Das sind dieselben Wege der Regulation, die die Forschung im Gehirn sieht.',
      link: '#gra/serce',
    },
    {
      id: 'stress',
      title: 'Stress',
      short: 'Der präfrontale Kortex spürt Stress stärker als jeder andere Teil des Gehirns — doch seine Schwächung geht oft vorüber, wenn der Stress nachlässt.',
      body: [
        { text: 'Unter akutem Stress schaltet das Gehirn auf schnelle, gewohnte Reaktionen um. Schon leichter, aber unkontrollierbarer Stress kann die Fähigkeiten, für die der präfrontale Kortex zuständig ist, rasch und deutlich schwächen.', refs: ['arnsten2009'] },
        { text: 'Lang anhaltender Stress verändert sogar den Bau der Nervenzellen dort. Die gute Nachricht: Diese Veränderungen müssen nicht bleiben. Der präfrontale Kortex ist ein Leben lang sehr formbar, wird mit dem Alter aber weniger widerstandsfähig.', refs: ['arnsten2009', 'mcewen2013'] },
      ],
      points: [
        { text: 'Der präfrontale Kortex ist der Bereich des Gehirns, der am empfindlichsten auf die schädlichen Wirkungen von Stress reagiert; langer Stress verändert die Verästelungen (Dendriten) seiner Nervenzellen.', refs: ['arnsten2009'] },
        { text: 'Eine Metaanalyse: Akuter Stress schwächt das Arbeitsgedächtnis und die Flexibilität; seine Wirkung auf die Hemmung ist vielschichtiger, und viele Effekte hängen von weiteren Faktoren wie dem Geschlecht ab.', refs: ['shields2016'] },
        { text: 'Eine Bildgebungsstudie: Bei 20 gesunden Personen schwächte ein Monat psychosozialer Stress die Aufmerksamkeitskontrolle und die Verbindungen in einem fronto-parietalen Netzwerk. Nach einem Monat mit weniger Stress unterschieden sie sich nicht mehr von einer ruhigen Vergleichsgruppe.', refs: ['liston2009'] },
        { text: 'Stressbedingte Veränderungen müssen nicht dauerhaft sein: Bei jungen Tieren erholen sich die Nervenzellen, wenn der Stress endet; mit dem Alter nimmt diese Widerstandskraft ab.', refs: ['mcewen2013'] },
      ],
      strength: 'moderate',
      forYou: 'Wenn du unter Stress keinen klaren Gedanken fassen kannst, ist das kein Charakterfehler, sondern Physiologie. Ruhe, Schlaf und ruhiger Atem geben deinem präfrontalen Kortex die Chance, sich zu erholen.',
      link: '#gra/drzewo',
    },
    {
      id: 'anxiety',
      title: 'Angst',
      short: 'Bei Angststörungen arbeiten die Alarmbereiche des Gehirns zu stark; der präfrontale Kortex hilft zu lernen, dass man jetzt sicher ist.',
      body: [
        { text: 'Angst ist nötig — sie schützt vor Gefahr. Schwierig wird es, wenn der Alarm zu oft, zu stark anspringt oder sich nicht mehr abschalten lässt.', refs: [] },
        { text: 'Menschen mit verschiedenen Angststörungen zeigen stärkere Aktivität im Mandelkern und in der Inselrinde — denselben Strukturen, die bei Gesunden reagieren, wenn sie Furcht lernen. Bei der posttraumatischen Belastungsstörung (PTBS) sind zusätzlich Bereiche weniger aktiv, die beim Regulieren von Gefühlen helfen, darunter der ventromediale präfrontale Kortex.', refs: ['etkin2007'] },
        { text: 'Furcht zu verlernen, die sogenannte Extinktion, ist aktives Lernen mit eigenen Schaltkreisen im Gehirn, die bei Tieren und Menschen parallel erforscht werden; zu den beteiligten Bereichen gehört der ventromediale präfrontale Kortex.', refs: ['milad2012', 'buhle2014'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von Studien zu PTBS, sozialer Angststörung und spezifischer Phobie: Bei allen dreien waren Mandelkern und Inselrinde aktiver.', refs: ['etkin2007'] },
        { text: 'Nur bei PTBS waren der dorsale und der vordere Gyrus cinguli sowie der ventromediale präfrontale Kortex weniger aktiv — Bereiche, die mit dem Erleben und Regulieren von Gefühlen verbunden sind.', refs: ['etkin2007'] },
        { text: 'Die Extinktion von Furcht ist zum Vorbild einer Forschung geworden, die „vom Tier zum Menschen“ führt — dank enger Zusammenarbeit beider Bereiche.', refs: ['milad2012'] },
        { text: 'Die Bedeutung einer Situation zu verändern (Neubewertung) beruhigt den Mandelkern.', refs: ['buhle2014'] },
        { text: 'Bei Gesunden ging langsames Atmen mit weniger Erregung und schwächeren Angstsymptomen einher.', refs: ['zaccaro2018'] },
      ],
      strength: 'moderate',
      forYou: 'Wenn dir Angst den Schlaf oder den Alltag nimmt, sprich mit einer Ärztin, einem Arzt oder einer Psychotherapeutin bzw. einem Psychotherapeuten. Ruhiger Atem und Gebet können helfen, zur Ruhe zu kommen, ersetzen aber keine Behandlung.',
    },
    {
      id: 'depression',
      title: 'Depression',
      short: 'Bei Depression arbeitet der präfrontale Kortex anders und das Denken leidet; deshalb ist der vordere Teil des Gehirns das Ziel der Magnetstimulation.',
      body: [
        { text: 'Depression ist nicht nur Traurigkeit. Oft schwächt sie auch Konzentration, Arbeitsgedächtnis und Entscheidungsfähigkeit — echte, messbare Schwierigkeiten, keine Faulheit.', refs: ['snyder2013'] },
        { text: 'Verschiedene Methoden — Bildgebung, Studien an Menschen mit Hirnverletzungen und Hirnstimulation — weisen auf zwei Schlüsselbereiche: den ventromedialen und den dorsolateralen präfrontalen Kortex, die bei Depression unterschiedliche Rollen spielen.', refs: ['koenigs2009'] },
        { text: 'Die repetitive transkranielle Magnetstimulation (rTMS) ist eine Behandlung, bei der eine Spule am Kopf einen ausgewählten Teil der Hirnrinde anregt — bei Depression meist den dorsolateralen präfrontalen Kortex. Über eine Behandlung entscheidet immer eine Ärztin oder ein Arzt.', refs: ['koenigs2009', 'brunoni2017'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 113 Studien: Depression geht mit schlechteren Ergebnissen in Tests der exekutiven Funktionen einher (Effektstärken von 0,32 bis 0,97); die Schwierigkeiten sind bei schwereren Symptomen größer.', refs: ['snyder2013'] },
        { text: 'Bildgebung, Läsionsstudien und Hirnstimulation weisen übereinstimmend auf den ventromedialen und den dorsolateralen präfrontalen Kortex als Schlüssel zur Depression — jeden mit einer anderen Rolle.', refs: ['koenigs2009'] },
        { text: 'Eine Netzwerk-Metaanalyse von 81 randomisierten Studien (4233 Patientinnen und Patienten): Mehrere Formen der rTMS wirkten in einer akuten depressiven Episode besser als eine Scheinstimulation; neuere Varianten (beschleunigt, tief) nicht.', refs: ['brunoni2017'] },
        { text: 'Eine Metaanalyse von 121 fNIRS-Studien — mit der Methode, die Mendi verwendet: Bei einer Wortaufgabe steigerten Stirn- und Schläfenlappen von Menschen mit Depression ihre Sauerstoffversorgung weniger als bei Gesunden.', refs: ['yeung2021'] },
        { text: 'Das sind Unterschiede zwischen Gruppenmittelwerten. Weder fNIRS noch die Asymmetrie von EEG-Wellen kann heute bei einem einzelnen Menschen eine Depression feststellen.', refs: ['yeung2021', 'vandervinne2017'] },
      ],
      strength: 'moderate',
      forYou: 'Emmanuel stellt keine Depression fest und behandelt sie nicht. Wenn du seit Wochen Traurigkeit, Leere oder Kraftlosigkeit spürst, sprich mit einer Ärztin oder einem Arzt. Training kann eine Behandlung begleiten, aber nicht ersetzen.',
    },
    {
      id: 'decisions',
      title: 'Entscheidungen, Werte und Selbstkontrolle',
      short: 'Der ventromediale präfrontale Kortex „bewertet“ die Möglichkeiten, der dorsolaterale hilft, das auf Dauer Wichtigere zu wählen.',
      body: [
        { text: 'Bei jeder Wahl vergleicht das Gehirn ganz verschiedene Dinge — Geschmack, Geld, Gesundheit, Zeit — auf einer einzigen inneren Werteskala. Dieses gemeinsame Wertsignal trägt der ventromediale präfrontale Kortex zusammen mit dem ventralen Striatum.', refs: ['bartra2013'] },
        { text: 'Selbstkontrolle sieht nicht aus wie ein Sieg der „Willenskraft“ über die Versuchung. In einer bekannten Studie bezog das Wertsignal bei Menschen, die sich beherrschten, auch die Gesundheit ein, nicht nur den Geschmack — und der dorsolaterale präfrontale Kortex war dann aktiver und arbeitete mit dem Bewertungsbereich zusammen.', refs: ['hare2009'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 206 Bildgebungsstudien: Der ventromediale präfrontale Kortex und das vordere ventrale Striatum bilden ein „Bewertungssystem“, das den subjektiven Wert kodiert — bei der Entscheidung und bei der Belohnung, für Geld wie für grundlegende Belohnungen.', refs: ['bartra2013'] },
        { text: 'Eine Studie mit Menschen auf Diät: Die Aktivität des ventromedialen präfrontalen Kortex folgte dem Wert einer Wahl; der dorsolaterale präfrontale Kortex war aktiver, wenn sich jemand beherrschte, und seine Aktivität ging mit der des Bewertungsbereichs einher.', refs: ['hare2009'] },
        { text: 'Versuchungen zu widerstehen gehört zu den exekutiven Funktionen — denselben, die Stress und Schlafmangel schwächen.', refs: ['diamond2013'] },
      ],
      strength: 'moderate',
      forYou: 'Triff wichtige Entscheidungen ausgeruht und gelassen, nicht in Eile. Und erinnere dich daran, was dir wirklich wichtig ist — bei Menschen mit Selbstkontrolle bezog das Wertsignal auch das längerfristige Ziel ein.',
    },
    {
      id: 'social',
      title: 'Der andere Mensch: Verstehen und Empathie',
      short: 'Der mediale präfrontale Kortex gehört zu einem Netzwerk, das arbeitet, wenn wir die Gedanken und Gefühle anderer zu verstehen versuchen.',
      body: [
        { text: 'Die Fähigkeit zu verstehen, was jemand denkt, will und fühlt, nennt die Psychologie „Theory of Mind“. Bildgebungsstudien weisen hier immer wieder auf den medialen Stirnlappen.', refs: ['amodio2006'] },
        { text: 'Ob Menschen Geschichten lasen oder Zeichnungen und Filme sahen — es zeigte sich derselbe Kern: der mediale präfrontale Kortex und die Region zwischen Schläfen- und Scheitellappen auf beiden Seiten des Gehirns.', refs: ['schurz2014'] },
      ],
      points: [
        { text: 'Übereinstimmende Befunde aus der Bildgebung weisen dem medialen Stirnlappen eine besondere Rolle in der sozialen Kognition zu.', refs: ['amodio2006'] },
        { text: 'Eine Metaanalyse von Studien zur Theory of Mind: gemeinsame Aktivität im medialen präfrontalen Kortex und im hinteren temporoparietalen Übergang beider Seiten, unabhängig von der Form der Aufgabe — der Kern des Netzwerks, mit dem wir andere verstehen.', refs: ['schurz2014'] },
        { text: 'Eine Studie mit gläubigen Christinnen und Christen: Persönliches Gebet in eigenen Worten — anders als eine auswendig gelernte Formel — aktivierte dieselben Bereiche der sozialen Kognition, darunter den medialen präfrontalen Kortex.', refs: ['schjoedt2009'] },
      ],
      strength: 'moderate',
      forYou: 'Jemandem aufmerksam zuzuhören und dich zu fragen, was er oder sie gerade fühlen mag, heißt, dieses Netzwerk im Alltag zu gebrauchen.',
      link: '#gra/brzemiona',
    },
    {
      id: 'sleep',
      title: 'Schlaf',
      short: 'Nach einer durchwachten Nacht leidet die Aufmerksamkeit am meisten, und der präfrontale Kortex arbeitet schwächer.',
      body: [
        { text: 'Schlafmangel ist mehr als Müdigkeit. Schon eine durchwachte Nacht verschlechtert die anhaltende Aufmerksamkeit und das Arbeitsgedächtnis deutlich, und die Bildgebung zeigt eine schwächere Arbeit des Aufmerksamkeitsnetzwerks in Stirn- und Scheitellappen.', refs: ['lim2010', 'ma2015'] },
        { text: 'Schlaf und Gefühle hängen eng zusammen: Fast alle affektiven und Angststörungen gehen mit Schlafproblemen einher. Forschende vermuten, dass Schlaf — besonders der REM-Schlaf — dem Gehirn hilft, sein emotionales Gleichgewicht für den nächsten Tag wiederherzustellen.', refs: ['goldstein2014'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 70 Arbeiten (147 Tests) zu Schlafentzug unter 48 h: von einer kleinen, nicht signifikanten Wirkung auf die Genauigkeit des Schlussfolgerns (g = −0,125) bis zu einer großen Wirkung auf Aussetzer der einfachen Aufmerksamkeit (g = −0,776).', refs: ['lim2010'] },
        { text: 'Eine Metaanalyse von 11 Bildgebungsstudien (185 Personen): Nach einer durchwachten Nacht waren unter anderem der rechte präfrontale Kortex, der mediale Stirnlappen, der intraparietale Sulcus und die Inselrinde weniger aktiv.', refs: ['ma2015'] },
        { text: 'Der Zusammenhang zwischen Schlaf und emotionaler Arbeit des Gehirns ist eng und ursächlich; REM-Schlaf könnte das emotionale Gleichgewicht des Gehirns stützen.', refs: ['goldstein2014'] },
        { text: 'Schlafmangel gehört zu den wichtigsten Faktoren, die exekutive Funktionen schwächen.', refs: ['diamond2013'] },
      ],
      strength: 'strong',
      forYou: 'Wenn das Training nach einer schlechten Nacht schlechter läuft, ist das normal. Guter Schlaf ist eines der einfachsten Dinge, die du für deinen präfrontalen Kortex tun kannst.',
    },
    {
      id: 'exercise',
      title: 'Bewegung',
      short: 'Regelmäßige Bewegung unterstützt das Denken — am deutlichsten die exekutiven Funktionen älterer Menschen; ein einzelnes Training wirkt nur wenig.',
      body: [
        { text: 'Körperliches Training gehört zu den am besten untersuchten Wegen, geistig fit zu bleiben. Bei älteren Menschen profitierten gerade die exekutiven Funktionen am meisten, die mit dem präfrontalen Kortex verbunden sind.', refs: ['colcombe2003'] },
        { text: 'Die Effekte sind echt, aber bescheiden: Ein einzelnes Training verbessert Testergebnisse geringfügig, Bewegung über Monate bringt einen kleinen, allgemeinen Gewinn. Am meisten halfen Übungen, die Koordination verlangen.', refs: ['chang2012', 'ludyga2020'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 18 Studien mit gesunden, wenig aktiven Älteren: Ausdauertraining brachte deutliche, aber gezielte Vorteile — die größten für die exekutive Kontrolle.', refs: ['colcombe2003'] },
        { text: 'Eine Metaanalyse von 79 Studien: Eine einzelne Trainingseinheit hat eine kleine positive Wirkung auf die geistige Leistung (g = 0,097) — während, direkt nach und einige Zeit nach der Anstrengung.', refs: ['chang2012'] },
        { text: 'Eine Metaanalyse von 80 randomisierten Studien: Die langfristige Wirkung von Bewegung auf das Denken ist klein und allgemein, nicht an eine Funktion gebunden; größer nach Koordinationstraining.', refs: ['ludyga2020'] },
        { text: 'Eine Übersicht über fNIRS-Studien: Bei sehr intensiver Anstrengung sinkt die Sauerstoffversorgung des präfrontalen Kortex mal, mal nicht — die Ergebnisse sind uneinheitlich, auch wegen Signalen von außerhalb des Gehirns.', refs: ['jung2025'] },
      ],
      strength: 'moderate',
      forYou: 'Ein Spaziergang, Tanzen oder ein Ballspiel tun dem Kopf auf Dauer gut. Trainiere mit dem Stirnband aber nicht während harter Anstrengung — das Signal ist dann unzuverlässig.',
    },
    {
      id: 'prayer',
      title: 'Gebet, Meditation und Atem',
      short: 'Kontemplative Übungen beanspruchen unter anderem den präfrontalen Kortex; die Befunde sind vielversprechend, aber noch vorläufig.',
      body: [
        { text: 'Meditation ist eine ganze Familie von Übungen: auf einen Punkt sammeln, ein Wort wiederholen, offene Achtsamkeit, Güte gegenüber anderen. Jede hat im Gehirn eine etwas andere „Handschrift“, und manche Bereiche — darunter der Stirnpol, die Inselrinde und der vordere Gyrus cinguli — tauchen bei vielen auf.', refs: ['fox2016'] },
        { text: 'Studien zum Gebet gibt es wenige. In einer davon beanspruchte persönliches Gebet in eigenen Worten die Bereiche, die wir in Beziehungen zu anderen Menschen nutzen — die Autoren beschreiben es als Erfahrung einer Begegnung, nicht als bloßes Aufsagen.', refs: ['schjoedt2009'] },
        { text: 'Der einfachste Weg in die Stille ist langsames Atmen. Eine systematische Übersicht verbindet es mit höherer Herzratenvariabilität, einem ruhigeren EEG und besserem Befinden.', refs: ['zaccaro2018'] },
      ],
      points: [
        { text: 'Eine Metaanalyse von 78 Bildgebungsstudien zur Meditation: Verschiedene Stile zeigen eigene Aktivitätsmuster, gemeinsame Bereiche sind eher die Ausnahme als die Regel; mittlere Effekte, mit vielen methodischen Vorbehalten.', refs: ['fox2016'] },
        { text: 'Eine Metaanalyse von Studien zur Hirnstruktur (21 Studien, etwa 300 Übende): Unterschiede unter anderem im Stirnpol (Bewusstsein der eigenen Gedanken), in der Inselrinde und im orbitofrontalen Kortex; die Autoren warnen vor Publikationsverzerrung.', refs: ['fox2014'] },
        { text: 'Persönliches Gebet aktivierte den medialen präfrontalen Kortex und die temporoparietale Region — das Netzwerk der sozialen Kognition.', refs: ['schjoedt2009'] },
        { text: 'Eine Übersicht über 15 Studien zum langsamen Atmen (weniger als 10 Atemzüge pro Minute): mehr Alpha- und weniger Theta-Wellen im EEG, höhere Herzratenvariabilität und im Befinden mehr Ruhe und Wachheit, weniger Angst und Ärger.', refs: ['zaccaro2018'] },
      ],
      strength: 'early',
      forYou: 'Die Forschung zeigt, was im Gehirn geschieht, während du betest — sie sagt nicht, wer zuhört. Emmanuel erzeugt keinen Glauben; es hilft, die Stille zu üben, in der das Beten leichter fällt.',
      link: '#gra/dlonie',
    },
    {
      id: 'life',
      title: 'Von der Kindheit bis ins Alter',
      short: 'Der präfrontale Kortex reift am längsten, bis ins frühe Erwachsenenalter, und arbeitet im Alter oft intensiver, um die Leistung zu halten.',
      body: [
        { text: 'Die Hirnrinde reift in Etappen: zuerst die Bereiche der Sinne (Tasten, Sehen), später jene, die Informationen verknüpfen — und der präfrontale Kortex gehört zu den letzten. Dieser Prozess reicht durch die Jugend bis ins frühe Erwachsenenalter.', refs: ['gogtay2004'] },
        { text: 'Bei Jugendlichen reagieren Belohnungs- und Gefühlssystem sehr stark, während die Impulskontrolle noch reift. Das hilft zu verstehen, woher riskante Entscheidungen in diesem Alter kommen.', refs: ['casey2008'] },
        { text: 'Bei Älteren arbeitet der präfrontale Kortex bei denselben Aufgaben oft stärker als bei Jungen, als lege das Gehirn Anstrengung nach. Formbarkeit bleibt ein Leben lang, auch wenn die Widerstandskraft gegen Stress mit dem Alter sinkt.', refs: ['spreng2010', 'mcewen2013'] },
      ],
      points: [
        { text: 'Eine Längsschnittstudie (13 Kinder, alle 2 Jahre eine Hirnaufnahme, Alter 4–21 Jahre): Assoziationsbereiche höherer Ordnung reifen erst nach der sensorischen Rinde; entwicklungsgeschichtlich ältere Bereiche reifen früher als jüngere.', refs: ['gogtay2004'] },
        { text: 'In der Pubertät geht eine erhöhte Empfänglichkeit für Belohnungen und sozial-emotionale Situationen mit einer noch unreifen Impulskontrolle einher.', refs: ['casey2008'] },
        { text: 'Eine Metaanalyse von 80 Stichproben: Ältere beanspruchten den präfrontalen Kortex stärker als Jüngere; bei gleicher Leistung den linken, bei schwächerer Leistung den rechten.', refs: ['spreng2010'] },
        { text: 'Der präfrontale Kortex bleibt ein Leben lang formbar; mit dem Alter werden seine Nervenzellen weniger widerstandsfähig gegen Stress.', refs: ['mcewen2013'] },
        { text: 'Bei Älteren unterstützte Bewegung vor allem die exekutiven Funktionen.', refs: ['colcombe2003'] },
      ],
      strength: 'moderate',
      forYou: 'Für das Üben von Aufmerksamkeit ist es nie zu spät — das Gehirn verändert sich ein Leben lang.',
    },
    {
      id: 'neurofeedback',
      title: 'Neurofeedback: was wir wissen und was noch nicht',
      short: 'Menschen können lernen, das Signal ihres eigenen präfrontalen Kortex zu verändern; ob und wie sich das auf den Alltag überträgt, ist noch nicht sicher.',
      body: [
        { text: 'Neurofeedback ist Training mit einem Spiegel: Eine App zeigt das Signal deines Gehirns in Echtzeit, und du lernst, es zu verändern. So arbeitet Emmanuel — die Kugel, das Spiel oder das Licht antworten auf die Arbeit deines präfrontalen Kortex.', refs: ['sitaram2017'] },
        { text: 'fNIRS-Studien zeigen, dass sich die Sauerstoffversorgung des präfrontalen Kortex so beeinflussen lässt. Doch es gibt noch wenige, sie sind klein und uneinheitlich, und gut kontrollierte klinische Studien bestätigen oft nicht, was schwächere gezeigt haben.', refs: ['kohl2020', 'cortese2016'] },
        { text: 'Aus der Forschung zum Gehirntraining weiß man außerdem: Training verbessert vor allem das, was geübt wird — und viel weniger das, was davon weit entfernt ist.', refs: ['melbylervag2016'] },
      ],
      points: [
        { text: 'Durch Neurofeedback erlernte Kontrolle über bestimmte Hirnbereiche kann bestimmte Verhaltensweisen verändern; die Mechanismen beginnen wir gerade erst zu verstehen.', refs: ['sitaram2017'] },
        { text: 'Eine systematische Übersicht über 22 fNIRS-Neurofeedback-Studien (441 Personen): Menschen können das Signal der Hirnrinde regulieren; die Studienqualität ist mittelmäßig, große randomisierte Studien fehlen, Aussagen über den klinischen Nutzen sind verfrüht.', refs: ['kohl2020'] },
        { text: 'Eine Metaanalyse von 13 randomisierten Studien (ADHS, 520 Personen): Verbesserungen sahen vor allem Beurteilende, die von der Behandlung wussten; bei „verblindeten“ Urteilen und im Vergleich mit Scheintraining war der Effekt nicht signifikant.', refs: ['cortese2016'] },
        { text: 'Eine Metaanalyse von 87 Veröffentlichungen zum Training des Arbeitsgedächtnisses: Zugewinne bei geübten und eng verwandten Aufgaben, keine überzeugenden Belege für eine Übertragung auf Intelligenz oder Lesen.', refs: ['melbylervag2016'] },
      ],
      strength: 'early',
      forYou: 'Sieh Emmanuel als Spiegel und als Gewohnheit der Stille, nicht als Wunderkur. Am meisten bewirken Regelmäßigkeit, Schlaf, Bewegung und Gebet; das Stirnband hilft dir zu bemerken, wann deine Aufmerksamkeit abschweift.',
      link: '#trening/focus',
    },
    {
      id: 'practice',
      title: 'Was das im Alltag bedeutet',
      short: 'Der präfrontale Kortex arbeitet am besten, wenn du ausgeschlafen, ruhig und in Bewegung bist — und Aufmerksamkeit übt man durch geduldiges Zurückkehren.',
      body: [
        { text: 'Aus der Forschung ergibt sich ein einfaches Bild. Der präfrontale Kortex ist mächtig, aber empfindlich: Unter Stress und ohne Schlaf lässt er schnell nach, und er erholt sich, wenn er Ruhe bekommt. Er ist kein „Zentrum der Willenskraft“, sondern Teil eines Netzwerks, das durch Wiederholung lernt.', refs: ['arnsten2009', 'liston2009', 'menon2011'] },
        { text: 'Du musst nicht alles auf einmal ändern. Wähle eines: Schlaf, Bewegung, ein paar Minuten langsames Atmen oder einen kurzen täglichen Moment der Sammlung.', refs: [] },
      ],
      points: [
        { text: 'Schlaf: Schlafmangel trifft die einfache, anhaltende Aufmerksamkeit am härtesten.', refs: ['lim2010'] },
        { text: 'Stress: Die Schwächung des präfrontalen Kortex nach einem Monat Stress verschwand, als der Stress nachließ.', refs: ['liston2009'] },
        { text: 'Bewegung: Regelmäßige Anstrengung bringt einen kleinen, aber allgemeinen Gewinn für das Denken.', refs: ['ludyga2020'] },
        { text: 'Atem: Langsames Atmen ging mit mehr Ruhe und Wachheit einher.', refs: ['zaccaro2018'] },
        { text: 'Realismus: Training verbessert vor allem, was du übst — übe also, was du im Leben brauchst: Stille, Aufmerksamkeit und Zurückkehren.', refs: ['melbylervag2016'] },
      ],
      forYou: 'Fang mit ein paar Minuten am Tag an. Wenn die Gedanken abschweifen, kehr zurück — ohne zu urteilen. Genau das ist das Training.',
      link: '#trening',
    },
  ],

  limits: {
    title: 'Die Grenzen dieses Wissens',
    points: [
      { text: 'Die meisten Studien zeigen Zusammenhänge, keine Ursachen: Wenn ein Bereich bei einer Aufgabe „aufleuchtet“, heißt das nicht, dass er allein für sie zuständig ist.', refs: [] },
      { text: 'Das Gehirn arbeitet in Netzwerken. Es gibt kein „Zentrum der Willenskraft“ und kein „Zentrum der Empathie“ — Abkürzungen wie „präfrontaler Kortex = Willenskraft“ sind ein Mythos.', refs: ['menon2011'] },
      { text: 'Die Ergebnisse sind Gruppenmittelwerte. Aus ihnen lässt sich keine Diagnose für einen einzelnen Menschen ablesen — weder aus dem Scanner noch aus dem Stirnband.', refs: ['yeung2021', 'vandervinne2017'] },
      { text: 'Eine Messung an der Stirn kann Signale von außerhalb des Gehirns enthalten, und die Belege für die Wirksamkeit von Neurofeedback sind noch bescheiden.', refs: ['tachtsidis2016', 'kohl2020', 'cortese2016'] },
      { text: 'Dieser Text ist kein medizinischer Rat. In Fragen der Gesundheit — von Körper und Seele — sprich mit einer Ärztin oder einem Arzt.', refs: [] },
    ],
  },

  reviewed: '2026-11',
};

export default article;
