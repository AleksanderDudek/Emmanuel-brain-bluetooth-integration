/**
 * Dawid's story words: the wilderness of En-Gedi, German (from the Polish source, story-engedi.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Saul jagt David mit dreitausend auserlesenen Männern durch die ganze Wüste. David und seine Vierhundert verstecken sich in den Felsen von En-Gedi, wo eine Quelle sprudelt und Steinböcke springen.',
  areas: {
    skaly: { name: 'Die Steinbockfelsen', line: 'Felsstufen, Steinböcke auf den Simsen, Karakale in den Spalten. Achte auf deine Schritte.' },
    jaskinia: { name: 'Die Höhle bei den Hürden', line: 'Schafhürden aus Stein, dahinter der dunkle Eingang einer Höhle. Drinnen kühl und still.' },
    zrodlo: { name: 'Die Quelle von En-Gedi', line: 'Wasser fällt vom Felsen, ringsum Palmen und Schilf. Der schönste Ort der Wüste.' },
  },
  quests: {
    achimelek: 'Geh zum Priester Ahimelech in Nob',
    benajasz: 'Finde Benaja',
    cave: 'Versteck dich in der Höhle',
    call: 'Ruf dem König vom Hügel nach',
    water: 'Füll die Wasserschläuche in der Höhle',
    abigail: 'Geh Abigajil entgegen',
    kid: 'Rette das Zicklein vor den Karakalen',
  },
  things: {
    water: 'Wasserschlauch',
    kid: 'Zicklein',
    corner: 'Zipfel des Mantels',
  },
  scenes: {
    open: [
      ['narrator', 'In der Höhle Adullam kommen Davids Brüder zu ihm, dann die Bedrängten, Verschuldeten und Verbitterten.'],
      ['klebek', 'Vierhundert neue Freunde! Hoffentlich mag keiner von ihnen Lammbraten.'],
      ['narrator', 'Mit ihnen zieht David in die Wüste En-Gedi am Salzmeer. König Saul sucht ihn überall.'],
      ['abiszaj', 'Onkel, vierhundert Männer und eine Quelle. Wir brauchen Wasser, Brot und ein wenig Ruhe.'],
      ['klebek', 'Und Käse. Vierhundert Käse. Na gut, dreihundert. Ich esse ja kaum etwas.'],
    ],
    achimelek: [
      ['narrator', 'Hungrig und ohne Waffe kommt David nach Nob, in die Stadt der Priester. Seine Leute warten versteckt.'],
      ['achimelek', 'Allein? Ohne deine Leute? Was ist geschehen?'],
      ['dawid', 'Eine dringende Sache, Priester. Hast du etwas Brot für den Weg?'],
      ['achimelek', 'Nur die Schaubrote, heute vom Tisch genommen. Nimm sie, und das Schwert des Riesen, in einen Mantel gehüllt.'],
      ['klebek', 'Goliaths Schwert? Doppelt so lang wie ich. Und schwerer als wir beide.'],
    ],
    benajasz: [
      ['benajasz', 'Ich bin Benaja. Ich höre, du sammelst Männer, die keine Angst haben.'],
      ['klebek', 'Du hast keine Angst? Vor nichts? Nicht einmal vor einem Löwen?'],
      ['benajasz', 'An einem Schneetag stieg ich einmal in eine Grube, in der ein Löwe saß. Und ich kam allein wieder heraus.'],
      ['klebek', 'Ich war einmal im Maul eines Löwen. Ich kam auch wieder heraus. Mit Hilfe. Wir haben etwas gemeinsam.'],
    ],
    cave: [
      ['narrator', 'Saul hält mit seinem Heer bei den Hürden. Er geht allein in die Höhle, ohne zu wissen, wer in der Tiefe sitzt.'],
      ['abiszaj', 'Onkel, das ist er! Allein, ohne Wache. So ein Augenblick kommt nie wieder.'],
      ['dawid', 'Ich erhebe meine Hand nicht gegen den König. Es ist nicht an mir, ihn zu richten.'],
      ['klebek', 'Pst. Er ruht sich aus. Wir atmen leise. Ganz leise.'],
    ],
    call: [
      ['narrator', 'Saul verlässt die Höhle und geht seines Weges. David läuft ihm auf den Hügel nach und ruft.'],
      ['dawid', 'Mein Herr und König! Ich war in der Höhle dicht bei dir und habe meine Hand nicht gegen dich erhoben.'],
      ['saul', 'David? Bist du das? …Mein Sohn, in deinem Herzen ist mehr Gutes als in meinem.'],
      ['narrator', 'Saul weint. Dann kehrt er mit seinem Heer nach Hause zurück.'],
      ['klebek', 'Der König weint, ich weine, sogar die Steinböcke haben feuchte Augen. Ein guter Tag.'],
    ],
    water: [
      ['narrator', 'Von der Decke der Höhle tropft Wasser, Tropfen um Tropfen. Drei Schläuche sind voll.'],
      ['abiszaj', 'Tropfen um Tropfen, und die Männer haben zu trinken. Gute Arbeit, Onkel.'],
      ['klebek', 'Ich habe nur einen Schluck getrunken. Einen großen. Einen sehr großen. Aber nur einen.'],
    ],
    abigail: [
      ['narrator', 'Der reiche Nabal aus Karmel schickte Davids Leute leer fort, obwohl sie seine Herden hüteten. David zürnt.'],
      ['narrator', 'Doch auf dem Weg kommt Abigajil, Nabals Frau, auf einem Esel, mit Brot, Rosinen und Feigenkuchen.'],
      ['abigail', 'Mein Herr, achte nicht auf Nabal. Sein Name heißt „Tor“, und so ist er auch.'],
      ['abigail', 'Lade kein Unrecht auf dich, das du später bereuen würdest. Nimm diese Gaben an.'],
      ['dawid', 'Danke für deine Klugheit. Du bewahrst mich vor einem schlimmen Schritt.'],
      ['klebek', 'Feigenkuchen! Sie weiß, wie man mit einer Truppe redet.'],
    ],
    kid: [
      ['narrator', 'Die Karakale fliehen in die Spalten. Auf einem Felssims zittert ein kleines Zicklein.'],
      ['klebek', 'Ganz ruhig, Kleines. Ich war auch mal in der Klemme. Jetzt gehe ich mit David, und alles ist gut.'],
      ['narrator', 'Das Zicklein springt zu seiner Mutter. Die Geiß sieht David lange an, dann verschwinden beide in den Felsen.'],
    ],
    end: [
      ['narrator', 'Der Leopard springt auf den Felsen und verschwindet hinter dem Grat. Der Pfad nach Westen, nach Gat, ist frei.'],
      ['dawid', 'Saul wird nicht aufhören, mich zu suchen. Ich gehe dorthin, wo er nicht sucht: zu den Philistern.'],
      ['abigail', 'Wir kommen mit dir. Die Vorräte reichen für den Weg.'],
      ['klebek', 'Nach Gat? Wo die Riesen wohnen? Gut. Aber ich gehe ganz in der Mitte der Truppe.'],
    ],
  },
  choices: {
    cave: {
      a: 'Schneid einen Zipfel ab',
      b: 'Zieh dich leise zurück',
      ra: [
        ['narrator', 'David schneidet einen Zipfel vom Mantel des Königs. Saul merkt nichts.'],
        ['klebek', 'Ein Zipfel vom Mantel. Der teuerste Flicken in ganz Israel.'],
      ],
      rb: [
        ['narrator', 'David zieht sich ins Dunkel zurück. Saul steht auf, richtet seinen Mantel und geht ahnungslos hinaus.'],
        ['klebek', 'Keiner weiß, wie knapp es war. Nur wir. Und das genügt.'],
      ],
    },
  },
};
