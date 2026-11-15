/**
 * The registry's lines for a mouse and a keyboard (DESIGN §14.6).  A game's card text, its lobby's three
 * lines and its calibration tips (i18n/arcade.ts) are written for a finger — "stuknij", "przesuń palcem" —
 * because most players hold a phone.  At a desktop the line with the same key here takes its place
 * (arcade/registry.ts, `forHands`).  Only a line that names a finger's gesture has a twin; a twin says the
 * click and, where the game has one, the key (the keys as the game's own how-to names them).
 */
import type { ArcadeKey } from './arcade';
import { lang, type Lang } from './index';

const pl = {
  // the runners
  'poslaniec.tip1': '←/→ albo A/D — pas, ↑ albo Spacja — skok, ↓ albo S — turlanie. Myszą: kliknij z boku — pas, w środek — skok.',
  'zacheusz.text': 'Zacheusz biegnie sam przez dwanaście ręcznie ułożonych poziomów Jerycha — Ty klikasz (albo Spacja): skok, wyższy skok, odbicie od ściany, bęc na grzbiecie gęsi. Skupienie wznosi drogę ze światła nad dachami, prosto do wysokich denarów, a spokój dojrzewa figi w ogrodzie. Każdy poziom kończy palma: im wyżej ją chwycisz, tym lepiej.',
  'zacheusz.tip1': 'Kliknij albo Spacja — skok, przytrzymaj — wyżej. W powietrzu jeszcze raz — obrót, przy ścianie — odbicie.',
  'pasterz.text': 'Po burzy owce całej wioski rozbiegły się po wzgórzach. Prowadź pasterza myszą albo strzałkami: luźne owce dołączają do Twojego stada, a większe stado przejmuje owce mniejszego. Krąg wołania to Twój sygnał: rośnie ze skupieniem i sam przyciąga owce.',
  'pasterz.tip1': 'Przytrzymaj przycisk myszy (albo strzałki) — pasterz idzie do wskaźnika. Kliknij albo Spacja, a Łatek przygoni owce.',
  'dolina.how3': 'Rękami: kliknij albo Spacja, by skoczyć; w powietrzu drugi raz — podwójny skok.',
  'dolina.tip1': 'Kliknij albo Spacja, by skoczyć; w powietrzu jeszcze raz — podwójny skok. Przytrzymaj, by skoczyć wyżej.',
  // the visualisations
  'jestem.tip3': 'Bez klikania barwa płynie sama: od serca obrazu, fragment po fragmencie. Cały fragment staje się jedną szybą.',
  'glina.text': 'Klienci przynoszą zamówienia z kształtem na kartce. Toczysz naczynie na kole, prowadząc glinę myszą, szkliwisz je, wypalasz i sprzedajesz. Skupienie uspokaja koło i rysuje złotą linię mistrza, a spokój trzyma równy żar w piecu.',
  'glina.tip1': 'Ciągnij myszą po ścianie gliny: do środka węziej, na zewnątrz szerzej. Brzeg ciągnij w górę.',
  // the body series
  'odpornosc.how3': 'Rękami: przeciągnij myszą, by poprowadzić rój neutrofili; kliknij intruza albo zakażoną komórkę, by wskazać cel.',
  'swiatlo.how3': 'Rękami: kliknij ciało albo okrągły przycisk (albo Spacja) — pomagasz narządowi w świetle (przy sercu w rytm uderzeń); kliknij panel (albo Enter) — karta Wiedzy.',
  'synapsy.text': 'Neurony, które razem się pobudzają, łączą się ze sobą. Buduj w dwóch półkulach drogi myśli — od oka i ucha do dłoni i głosu: klikaj pary neuronów, a między nimi wyrasta synapsa; Oli, oligodendrocyt, owija aksony mieliną i sygnał przyspiesza; most spoidła wielkiego świeci, gdy opaska widzi równowagę lewej i prawej części kory czołowej. Skupienie przyspiesza wzrost połączeń, spokój je utrwala i porządkuje — jak sen.',
  'synapsy.how3': 'Rękami: kliknij dwa neurony po kolei albo przeciągnij przez kilka, by je połączyć; kliknij Oli (albo O), a owinie akson mieliną.',
  'odnowa.how3': 'Rękami: kliknij uszkodzenie DNA, by wysłać enzym; kliknij turbinę (albo Spacja), gdy świeci Pełna moc.',
  // the battlers
  'aniol.text': 'Jezus posłał Cię, byś strzegł snu dziecka. Zmory skradają się z obu stron do łóżka — kliknij lewą albo prawą stronę (albo ←/→), a skrzydło światła je przegoni. Każda noc to kolejny sen (strych, las, morze, obłoki) z wielkim koszmarem na koniec. Skupienie rozpala aurę, która rani zmory, a miś Pan Guzik dzielnie kibicuje.',
  'aniol.how3': 'Ciosy zadajesz Ty: kliknij stronę, z której nadchodzi zmora (albo ←/→) — najlepiej, gdy dopiero wchodzi w zasięg („Idealnie!”).',
  'zastepy.how3': 'Które wojska wyślesz, decydujesz Ty: kliknij kartę jednostki (albo 1–7), a drogę (albo H) — by postawić Słup obłoku.',
  'zastepy.tip1': 'Kliknij kartę na dole (albo 1–7), by wysłać jednostkę. Przycisk z chmurą (H) stawia Słup obłoku na linii frontu, a pełna trąba (T) odrzuca demony.',
  'jerzy.how3': 'Rękami: przeciągnij myszą w dowolnym miejscu (albo WASD / strzałki), by iść — broń tnie sama. Kliknij kartę przy poziomie (albo 1–3); kliknięcie albo Spacja uwalnia Miecz.',
  'chleby.how3': 'Rękami: przytrzymaj przycisk myszy, by sypać chlebami, prowadź myszą, by celować; kliknij pomoc (albo E), gdy się napełni.',
  'chleby.tip1': 'Przytrzymaj przycisk myszy, by sypać strumieniem, prowadź myszą w bok (albo ←/→), by celować; kliknięcie albo Spacja rzuca garść.',
  // the timing games
  'latarnik.text': 'Kliknij (albo Spacja), gdy promień latarni padnie na łódź. Każda noc ma swój cel i trzy gwiazdki: mgła, flotylla, szkwał. Skupienie wydłuża światło, spokój rozświetla morze i wyrzuca na brzeg bursztyny.',
  'latarnik.how3': 'Noce mają cele i gwiazdki, co piąta to szkwał. Kliknięcie (albo Spacja) zawsze należy do Ciebie.',
  'motylarnia.how3': 'Wskaż myszą albo kliknij, by skręcać; przytrzymaj przycisk (albo Spacja), by przyspieszyć.',
  // the puzzles
  'arka.text': 'Kliknij zwierzę, a zejdzie z pokładu tam, gdzie patrzy, jeśli nikt nie stoi mu na drodze. Skupienie rozsuwa mgłę po potopie, a spokój maluje tęczę, która oddaje serca.',
  // the strategy games
  'dawid.how3': 'Rękami: przeciągnij myszą albo idź WASD, albo kliknij obok Dawida (albo Spacja) — sam idzie na łowy. Pełną torbę zanieś do obozu (B) i kupuj przy ognisku.',
  'dziewiatka.how3': 'Rękami: kliknij świecący portret (albo jego cyfrę 1–5) — cios specjalny; przy studni kliknięcie przyszywa bohaterowi element stroju. Piątkę ustawiasz w lobby.',
  'nehemiasz.how3': 'Rękami: przeciągnij myszą albo idź WASD; stań na znaczniku, by budować albo ulepszać. Kliknij znacznik albo „Następne” (albo Spacja) — Nehemiasz idzie budować.',
  'koty.how3': 'Rękami: przeciągnij myszą zabawkę na drugą tej samej rangi, by je połączyć, albo na kota, by mu ją dać. Kliknij ulepszenie (albo 1–4), by je kupić.',
} satisfies Partial<Record<ArcadeKey, string>>;

type TwinKey = keyof typeof pl;
type Twins = Readonly<Record<TwinKey, string>>;

const en: Twins = {
  'poslaniec.tip1': '←/→ or A/D for a lane, ↑ or Space to jump, ↓ or S to roll. With the mouse: click a side for a lane, the middle to jump.',
  'zacheusz.text': 'Zacchaeus runs on his own through twelve hand-made levels of Jericho: you click (or press Space) to jump, hold to jump higher, kick off walls and bonk geese. Focus raises a road of light over the roofs, straight to the high denarii, and calm ripens the figs in the orchard. Every level ends at a palm: the higher you grab it, the better.',
  'zacheusz.tip1': 'Click or press Space to jump, hold to go higher. In the air, again to spin; against a wall, to jump off it.',
  'pasterz.text': 'After the storm the whole village\'s sheep are scattered over the hills. Lead the shepherd with the mouse or the arrow keys: loose sheep join your flock, and a bigger flock takes a smaller one\'s sheep. The ring of your call is your signal: it grows with focus and draws sheep in by itself.',
  'pasterz.tip1': 'Hold the mouse button (or the arrow keys): the shepherd walks to the pointer. Click or press Space, and Patch rounds up the sheep.',
  'dolina.how3': 'With your hands: click or press Space to jump; again in the air for a double jump.',
  'dolina.tip1': 'Click or press Space to jump; again in the air for a double jump. Hold to jump higher.',
  'jestem.tip3': 'Without a click, the colour flows by itself: from the heart of the picture, fragment by fragment. A whole fragment becomes one pane.',
  'glina.text': 'Customers bring orders with a shape on the slip. You throw the pot on the wheel, guiding the clay with the mouse, glaze it, fire it and sell it. Focus steadies the wheel and draws the master’s golden line, and calm keeps the kiln’s heat even.',
  'glina.tip1': 'Drag the clay’s wall with the mouse: inward narrower, outward wider. Pull the rim up.',
  'odpornosc.how3': 'With your hands: drag with the mouse to lead the swarm of neutrophils; click an intruder or an infected cell to point out a target.',
  'swiatlo.how3': 'With your hands: click the body or the round button (or press Space) to help the organ in the light (at the heart, on the beat); click the panel (or press Enter) for the Knowledge card.',
  'synapsy.text': 'Neurons that fire together wire together. Build paths for thoughts in two hemispheres, from the eye and the ear to the hand and the voice: click pairs of neurons and a synapse grows between them; Oli, an oligodendrocyte, wraps the axons in myelin and the signal speeds up; the bridge of the corpus callosum glows when the headband sees the left and right frontal cortex in balance. Focus speeds the growth of connections; calm sets them and tidies them up — as sleep does.',
  'synapsy.how3': 'With your hands: click two neurons one after the other, or drag across several, to connect them; click Oli (or press O) and she wraps an axon in myelin.',
  'odnowa.how3': 'With your hands: click DNA damage to send an enzyme; click the turbine (or press Space) when Full power glows.',
  'aniol.text': 'Jesus has sent you to guard a child’s sleep. Nightmares creep toward the bed from both sides: click the left or the right side (or press ←/→) and a wing of light drives them off. Every night is another dream (the attic, the forest, the sea, the clouds) with a great nightmare at its end. Focus kindles an aura that wounds the nightmares, and Mr Button the teddy bear cheers bravely.',
  'aniol.how3': 'The strikes are yours: click the side a nightmare comes from (or press ←/→), best just as it enters your reach (“Perfect!”).',
  'zastepy.how3': 'Which troops go out is your choice: click a unit card (or press 1–7), and click the road (or press H) to raise the pillar of cloud.',
  'zastepy.tip1': 'Click a card at the bottom (or press 1–7) to send a unit. The cloud button (H) raises the pillar of cloud at the front line, and a full trumpet (T) throws the demons back.',
  'jerzy.how3': 'With your hands: drag the mouse anywhere (or use WASD / the arrows) to walk — the weapons strike by themselves. Click a card at a level (or press 1–3); a click or Space releases the Sword.',
  'chleby.how3': 'With your hands: hold the mouse button to pour the loaves, move the mouse to aim; click the help (or press E) when it fills.',
  'chleby.tip1': 'Hold the mouse button to pour a stream, move the mouse sideways (or press ←/→) to aim; a click or Space throws a handful.',
  'latarnik.text': 'Click (or press Space) when the lighthouse beam falls on a boat. Every night has its goal and three stars: fog, a flotilla, a squall. Focus lengthens the light; calm lights up the sea and washes amber ashore.',
  'latarnik.how3': 'Nights have goals and stars; every fifth is a squall. The click (or Space) is always yours.',
  'motylarnia.how3': 'Point or click with the mouse to turn; hold the button (or Space) to speed up.',
  'arka.text': 'Click an animal and it leaves the deck the way it faces, if nobody stands in its way. Focus parts the mist after the flood, and calm paints a rainbow that gives hearts back.',
  'dawid.how3': 'With your hands: drag with the mouse or walk with WASD, or click beside David (or press Space) and he goes hunting by himself. Take a full bag to camp (B) and buy by the fire.',
  'dziewiatka.how3': 'With your hands: click a glowing portrait (or press its number, 1–5) — a special; at the well a click sews a piece of outfit onto a hero. You choose your five in the lobby.',
  'nehemiasz.how3': 'With your hands: drag with the mouse or walk with WASD; stand on a marker to build or upgrade. Click a marker or “Next” (or press Space) and Nehemiah goes to build.',
  'koty.how3': 'With your hands: drag a toy with the mouse onto another of the same grade to merge them, or onto a cat to hand it over. Click an upgrade (or press 1–4) to buy it.',
};

const de: Twins = {
  'poslaniec.tip1': '←/→ oder A/D – Spur, ↑ oder Leertaste – Sprung, ↓ oder S – Rolle. Mit der Maus: Klick an der Seite – Spur, in der Mitte – Sprung.',
  'zacheusz.text': 'Zachäus läuft von selbst durch zwölf handgebaute Level Jerichos – du klickst (oder drückst die Leertaste): Sprung, höherer Sprung, Wandsprung, Bonk auf dem Gänserücken. Fokus hebt einen Weg aus Licht über die Dächer, direkt zu den hohen Denaren, und Ruhe lässt im Garten die Feigen reifen. Jedes Level endet an einer Palme: Je höher du sie packst, desto besser.',
  'zacheusz.tip1': 'Klick oder Leertaste – Sprung, halten – höher. In der Luft noch einmal – Drehung, an der Wand – abstoßen.',
  'pasterz.text': 'Nach dem Sturm sind die Schafe des ganzen Dorfes über die Hügel verstreut. Führ den Hirten mit der Maus oder den Pfeiltasten: Freie Schafe schließen sich deiner Herde an, und die größere Herde übernimmt die Schafe der kleineren. Der Kreis deines Rufs ist dein Signal: Er wächst mit dem Fokus und zieht Schafe von selbst heran.',
  'pasterz.tip1': 'Halte die Maustaste (oder die Pfeiltasten) – der Hirte geht zum Zeiger. Klick oder Leertaste, und Flecki treibt die Schafe herbei.',
  'dolina.how3': 'Mit den Händen: Klick oder Leertaste zum Springen; in der Luft noch einmal – Doppelsprung.',
  'dolina.tip1': 'Klick oder Leertaste zum Springen; in der Luft noch einmal – Doppelsprung. Halten springt höher.',
  'jestem.tip3': 'Ohne Klick fließt die Farbe von selbst: vom Herzen des Bildes aus, Fragment für Fragment. Ein ganzes Fragment wird zu einer Scheibe.',
  'glina.text': 'Kunden bringen Aufträge mit einer Form auf dem Zettel. Du drehst das Gefäß auf der Scheibe und führst den Ton mit der Maus, glasierst es, brennst es und verkaufst es. Fokus beruhigt die Scheibe und zeichnet die goldene Linie des Meisters, und Ruhe hält die Glut im Ofen gleichmäßig.',
  'glina.tip1': 'Zieh die Wand des Tons mit der Maus: nach innen schmaler, nach außen breiter. Den Rand ziehst du nach oben.',
  'odpornosc.how3': 'Mit den Händen: Ziehe mit der Maus, um den Schwarm der Neutrophilen zu führen; klicke einen Eindringling oder eine infizierte Zelle an, um ein Ziel zu zeigen.',
  'swiatlo.how3': 'Mit den Händen: Klicke auf den Körper oder den runden Knopf (oder drück die Leertaste) — du hilfst dem Organ im Licht (am Herzen im Takt); klicke auf die Tafel (oder Enter) für die Wissenskarte.',
  'synapsy.text': 'Neuronen, die gemeinsam feuern, verbinden sich. Baue in zwei Hirnhälften Wege für Gedanken, vom Auge und vom Ohr zur Hand und zur Stimme: Klicke Paare von Neuronen an, und zwischen ihnen wächst eine Synapse; Oli, ein Oligodendrozyt, umwickelt die Axone mit Myelin, und das Signal wird schneller; die Brücke des Balkens leuchtet, wenn das Stirnband den linken und rechten Stirnlappen im Gleichgewicht sieht. Fokus lässt Verbindungen schneller wachsen; Ruhe festigt und ordnet sie — wie der Schlaf.',
  'synapsy.how3': 'Mit den Händen: Klicke zwei Neuronen nacheinander an oder ziehe über mehrere, um sie zu verbinden; klicke Oli an (oder drück O), und sie umwickelt ein Axon mit Myelin.',
  'odnowa.how3': 'Mit den Händen: Klicke einen DNA-Schaden an, um ein Enzym zu schicken; klicke die Turbine an (oder drück die Leertaste), wenn Volle Kraft leuchtet.',
  'aniol.text': 'Jesus hat dich gesandt, den Schlaf eines Kindes zu behüten. Albträume schleichen von beiden Seiten zum Bett – klicke links oder rechts (oder drück ←/→), und ein Flügel aus Licht vertreibt sie. Jede Nacht ist ein neuer Traum (Dachboden, Wald, Meer, Wolken) mit einem großen Albtraum am Ende. Fokus entfacht eine Aura, die die Albträume verwundet, und Herr Knopf, der Teddy, feuert tapfer an.',
  'aniol.how3': 'Die Schläge führst du: klicke auf die Seite, von der ein Albtraum kommt (oder drück ←/→), am besten, sobald er in die Reichweite kommt („Perfekt!“).',
  'zastepy.how3': 'Welche Truppen ausziehen, entscheidest du: klicke auf eine Einheitenkarte (oder 1–7), und auf den Weg (oder H), um die Wolkensäule aufzustellen.',
  'zastepy.tip1': 'Klicke unten auf eine Karte (oder 1–7), um eine Einheit auszusenden. Der Wolkenknopf (H) stellt die Wolkensäule an die Front, eine volle Posaune (T) wirft die Dämonen zurück.',
  'jerzy.how3': 'Mit den Händen: zieh die Maus irgendwo (oder WASD / Pfeiltasten), um zu gehen – die Waffen schlagen von selbst zu. Klicke auf jeder Stufe eine Karte (oder 1–3); ein Klick oder die Leertaste entfesselt das Schwert.',
  'chleby.how3': 'Mit den Händen: halte die Maustaste zum Schütten, führ die Maus zum Zielen; klicke auf die Hilfe (oder E), wenn sie voll ist.',
  'chleby.tip1': 'Halte die Maustaste, um einen Strom zu schütten, führ die Maus zur Seite (oder ←/→), um zu zielen; ein Klick oder die Leertaste wirft eine Handvoll.',
  'latarnik.text': 'Klick (oder drück die Leertaste), wenn der Strahl des Leuchtturms auf ein Boot fällt. Jede Nacht hat ihr Ziel und drei Sterne: Nebel, Flottille, Sturmbö. Fokus verlängert das Licht, Ruhe lässt das Meer leuchten und spült Bernstein an den Strand.',
  'latarnik.how3': 'Nächte haben Ziele und Sterne, jede fünfte ist eine Sturmbö. Der Klick (oder die Leertaste) gehört immer dir.',
  'motylarnia.how3': 'Zeig oder klick mit der Maus, um zu lenken; halt die Taste (oder die Leertaste), um zu sprinten.',
  'arka.text': 'Klick ein Tier an, und es verlässt das Deck in Blickrichtung, wenn ihm niemand im Weg steht. Fokus teilt den Nebel nach der Flut, und Ruhe malt einen Regenbogen, der Herzen zurückgibt.',
  'dawid.how3': 'Mit den Händen: Zieh mit der Maus oder geh mit WASD, oder klick neben David (oder drück die Leertaste), dann geht er von selbst auf die Jagd. Bring die volle Tasche ins Lager (B) und kauf am Feuer.',
  'dziewiatka.how3': 'Mit den Händen: Klick auf ein leuchtendes Porträt (oder drück seine Ziffer, 1–5) — ein Spezialangriff; am Brunnen näht ein Klick dem Helden ein Kleidungsstück an. Deine Fünf stellst du in der Lobby auf.',
  'nehemiasz.how3': 'Mit den Händen: Zieh mit der Maus oder geh mit WASD; stell dich auf eine Markierung, um zu bauen oder zu verbessern. Klick auf eine Markierung oder „Als Nächstes“ (oder die Leertaste), und Nehemia geht bauen.',
  'koty.how3': 'Mit den Händen: Zieh ein Spielzeug mit der Maus auf ein anderes gleichen Rangs, um sie zu verbinden, oder auf eine Katze, um es ihr zu geben. Klick auf eine Verbesserung (oder 1–4), um sie zu kaufen.',
};

const sv: Twins = {
  'poslaniec.tip1': '←/→ eller A/D – fil, ↑ eller mellanslag – hopp, ↓ eller S – rulla. Med musen: klicka på en sida för fil, i mitten för hopp.',
  'zacheusz.text': 'Sackeus springer av sig själv genom tolv handbyggda banor i Jeriko – du klickar (eller trycker på mellanslag): hopp, högre hopp, väggspjärn, bonk på gåsryggen. Fokus reser en väg av ljus över taken, rakt till de höga denarerna, och lugnet mognar fikonen i trädgården. Varje bana slutar vid en palm: ju högre du griper den, desto bättre.',
  'zacheusz.tip1': 'Klicka eller mellanslag – hopp, håll – högre. I luften en gång till – snurr; vid en vägg – spjärna ifrån.',
  'pasterz.text': 'Efter stormen är hela byns får utspridda över kullarna. Led herden med musen eller piltangenterna: lösa får ansluter sig till din hjord, och en större hjord tar en mindre hjords får. Ropets ring är din signal: den växer med fokus och drar till sig får av sig själv.',
  'pasterz.tip1': 'Håll ned musknappen (eller piltangenterna) – herden går mot pekaren. Klicka eller mellanslag, så driver Fläcken ihop fåren.',
  'dolina.how3': 'Med händerna: klicka eller mellanslag för att hoppa; igen i luften för dubbelhopp.',
  'dolina.tip1': 'Klicka eller mellanslag för att hoppa; igen i luften för dubbelhopp. Håll kvar för att hoppa högre.',
  'jestem.tip3': 'Utan klick flödar färgen av sig själv: från bildens hjärta, fragment för fragment. Ett helt fragment blir en enda ruta.',
  'glina.text': 'Kunder kommer med beställningar och en form på lappen. Du drejar kärlet och leder leran med musen, glaserar det, bränner det och säljer det. Fokus lugnar drejskivan och ritar mästarens gyllene linje, och lugn håller glöden i ugnen jämn.',
  'glina.tip1': 'Dra lerans vägg med musen: inåt smalare, utåt bredare. Kanten drar du uppåt.',
  'odpornosc.how3': 'Med händerna: dra med musen för att leda svärmen av neutrofiler; klicka på en inkräktare eller en infekterad cell för att peka ut ett mål.',
  'swiatlo.how3': 'Med händerna: klicka på kroppen eller den runda knappen (eller mellanslag) — du hjälper organet i ljuset (vid hjärtat i takt); klicka på panelen (eller Enter) för kunskapskortet.',
  'synapsy.text': 'Nervceller som avfyras tillsammans kopplas ihop. Bygg vägar för tankar i två hjärnhalvor, från ögat och örat till handen och rösten: klicka på par av nervceller, så växer en synaps mellan dem; Oli, en oligodendrocyt, lindar axonerna i myelin och signalen blir snabbare; hjärnbalkens bro lyser när pannbandet ser vänster och höger pannlob i balans. Fokus får kopplingarna att växa snabbare; lugn befäster och ordnar dem — som sömnen.',
  'synapsy.how3': 'Med händerna: klicka på två nervceller efter varandra, eller dra över flera, för att koppla ihop dem; klicka på Oli (eller O) så lindar hon ett axon i myelin.',
  'odnowa.how3': 'Med händerna: klicka på en DNA-skada för att skicka ett enzym; klicka på turbinen (eller mellanslag) när Full kraft lyser.',
  'aniol.text': 'Jesus har sänt dig för att vakta ett barns sömn. Mardrömmar smyger mot sängen från båda håll – klicka på vänster eller höger sida (eller ←/→), så driver en vinge av ljus bort dem. Varje natt är en ny dröm (vinden, skogen, havet, molnen) med en stor mardröm på slutet. Fokus tänder en aura som sårar mardrömmarna, och nallen Herr Knapp hejar modigt.',
  'aniol.how3': 'Slagen är dina: klicka på den sida en mardröm kommer ifrån (eller ←/→), helst precis när den kommer inom räckhåll (”Perfekt!”).',
  'zastepy.how3': 'Vilka trupper som går ut väljer du: klicka på ett enhetskort (eller 1–7), och på vägen (eller H) för att resa molnstoden.',
  'zastepy.tip1': 'Klicka på ett kort längst ner (eller 1–7) för att sända ut en enhet. Molnknappen (H) reser molnstoden vid fronten, och en full basun (T) kastar demonerna bakåt.',
  'jerzy.how3': 'Med händerna: dra med musen var som helst (eller WASD / piltangenterna) för att gå – vapnen hugger själva. Klicka på ett kort vid varje nivå (eller 1–3); ett klick eller mellanslag släpper lös svärdet.',
  'chleby.how3': 'Med händerna: håll ned musknappen för att hälla bröden, styr med musen för att sikta; klicka på hjälpen (eller E) när den är full.',
  'chleby.tip1': 'Håll ned musknappen för att hälla en ström, styr musen åt sidan (eller ←/→) för att sikta; ett klick eller mellanslag kastar en handfull.',
  'latarnik.text': 'Klicka (eller tryck på mellanslag) när fyrens ljusstråle faller på en båt. Varje natt har sitt mål och tre stjärnor: dimma, flottilj, byvind. Fokus förlänger ljuset, lugn lyser upp havet och spolar upp bärnsten på stranden.',
  'latarnik.how3': 'Nätterna har mål och stjärnor, var femte är en byvind. Klicket (eller mellanslaget) är alltid ditt.',
  'motylarnia.how3': 'Peka eller klicka med musen för att svänga; håll ned knappen (eller mellanslag) för att spurta.',
  'arka.text': 'Klicka på ett djur så lämnar det däck åt det håll det tittar, om ingen står i vägen. Fokus skingrar dimman efter floden, och lugnet målar en regnbåge som ger tillbaka hjärtan.',
  'dawid.how3': 'Med händerna: dra med musen eller gå med WASD, eller klicka bredvid David (eller mellanslag) så går han på jakt själv. Bär en full väska till lägret (B) och köp vid elden.',
  'dziewiatka.how3': 'Med händerna: klicka på ett lysande porträtt (eller dess siffra, 1–5) — ett specialslag; vid brunnen syr ett klick på ett plagg på hjälten. Din femma väljer du i lobbyn.',
  'nehemiasz.how3': 'Med händerna: dra med musen eller gå med WASD; ställ dig på en markering för att bygga eller förbättra. Klicka på en markering eller ”Nästa” (eller mellanslag) så går Nehemja och bygger.',
  'koty.how3': 'Med händerna: dra en leksak med musen till en annan av samma rang för att slå ihop dem, eller till en katt för att ge den. Klicka på en förbättring (eller 1–4) för att köpa den.',
};

export const MOUSE_CATALOGS: Readonly<Record<Lang, Twins>> = { pl, en, de, sv };

/** The mouse-and-keyboard twin of a registry line in this page's language, or null when the line has none. */
export function mouseText(key: string): string | null {
  return (MOUSE_CATALOGS[lang] as Readonly<Record<string, string>>)[key] ?? null;
}
