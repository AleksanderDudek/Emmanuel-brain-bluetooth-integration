/**
 * Dawid's story words: the pastures of Bethlehem, German (from the Polish source, story-pastwiska.ts: the same
 * ids, speakers and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Der jüngste der acht Söhne Isais hütet die Schafe seines Vaters auf den Hügeln von Bethlehem. Der Prophet Samuel ist auf dem Weg in die Stadt, und im Dickicht hinter dem Bach lauert wieder der Löwe.',
  areas: {
    owczarnia: { name: 'Isais Schafstall', line: 'Eine Steinmauer, eine Dornenhecke und hundert Schafe, die auf dich zählen.' },
    studnia: { name: 'Der Brunnen am Tor', line: 'Bethlehems Brunnen: das kälteste Wasser in ganz Juda. Am Tor döst ein alter Hirte.' },
    potok: { name: 'Der Bach der glatten Steine', line: 'Ein Bach voller runder Steine. Dahinter ein Dickicht, und im Dickicht brüllt jemand.' },
  },
  quests: {
    lamb: 'Finde das Lamm in den Dornen',
    well: 'Sprich mit dem Mädchen am Brunnen',
    jar: 'Bring dem alten Hirten einen Krug Wasser',
    asahel: 'Finde Asahel auf dem Hügel',
    ewe: 'Rette ein Schaf und sein Lamm vor den Wölfen',
  },
  things: {
    lamb: 'verirrtes Lamm',
    jar: 'Krug Wasser',
  },
  scenes: {
    open: [
      ['narrator', 'Der Prophet Samuel kommt in Isais Haus. Sieben Söhne treten vor ihn.'],
      ['samuel', 'Der ist es auch nicht. Hast du noch einen Sohn, Isai?'],
      ['jesse', 'Da ist noch der Jüngste, David. Er hütet die Schafe. Er riecht immer nach Schaf.'],
      ['narrator', 'David kommt von der Weide gelaufen. Samuel salbt ihn mitten unter seinen Brüdern.'],
      ['eliab', 'Der? Der mit den Schafen? Ich bin doch der Größte!'],
      ['klebek', 'Jetzt riecht er nach Öl. Und nach Schaf. Aber vor allem nach Öl.'],
    ],
    lamb: [
      ['klebek', 'Hörst du das Blöken? Das bin nicht ich. Ich blöke schöner.'],
      ['narrator', 'In den Dornen sitzt ein kleines Lamm, verheddert bis über die Ohren. David befreit es behutsam.'],
      ['klebek', 'Willkommen in der Herde, Kleines. Regel eins: keine Dornen. Regel zwei: Wir bleiben bei David.'],
    ],
    well: [
      ['dziewczyna', 'War der Prophet bei euch? Ganz Bethlehem redet davon.'],
      ['dawid', 'Ja. Er hat mit uns gegessen und ist gegangen. Und ich bin zurück zu den Schafen.'],
      ['dziewczyna', 'Der Krug ist schwer, und nach Hause ist es weit. Du spielst auch Harfe, heißt es?'],
      ['klebek', 'Er spielt. Und er trägt. Nur nicht gleichzeitig.'],
    ],
    jar: [
      ['starzec', 'Wasser vom Brunnen am Tor… Mein Großvater hat es getrunken und sein Großvater. Ich danke dir von Herzen.'],
      ['starzec', 'Heute Nacht habe ich Wölfe am Bach gesehen. Pass auf die Schafe auf, sie holen sich die Jüngsten.'],
      ['klebek', 'Die Jüngsten? Das bin ja ich! Na ja, fast. Passen wir auf die Schafe auf.'],
    ],
    asahel: [
      ['asahel', 'Onkel! Ich habe gehört, der Prophet war bei Großvater. Jetzt laufen wir aber wirklich um die Wette zum Löwen!'],
      ['dawid', 'Zum Löwen läuft man nicht um die Wette, Asahel. Zum Löwen geht man vorsichtig.'],
      ['asahel', 'Vorsichtig, aber schnell! Ich laufe schneller als eine Gazelle. Du wirst sehen.'],
      ['klebek', 'Einer läuft wie eine Gazelle, einer wirft wie ein Sturm. Und ich? Ich helfe moralisch.'],
    ],
    ewe: [
      ['narrator', 'Die Wölfe fliehen ins Gebüsch. Ein Schaf und sein Lamm drücken sich an Davids Beine.'],
      ['klebek', 'Ganz ruhig, Mama. Das ist David. Der macht das immer so: kommt, wirft, die Wölfe sind weg.'],
      ['jesse', 'Du hütest die Herde gut, David. Aber aus dem Dickicht kommt Gebrüll. Der Löwe ist nah.'],
    ],
    end: [
      ['narrator', 'Der Löwe kriegt einen Stein auf die Nase und flieht in die Berge. Die Schafe kommen eins nach dem andern heim.'],
      ['jesse', 'Alle Schafe heil. Und Flocke?'],
      ['klebek', 'Auch heil. Danke der Nachfrage. Etwas spät, aber immerhin.'],
      ['narrator', 'Am Abend kommt Nachricht: König Saul kann nicht schlafen, und seine Diener suchen einen Harfenspieler.'],
      ['klebek', 'Du spielst Harfe! Ich singe. Mehr oder weniger. Auf in die Hügel?'],
    ],
  },
  choices: {
    well: {
      a: 'Trag ihren Krug nach Hause',
      b: 'Spiel ihr etwas auf der Harfe',
      ra: [
        ['dziewczyna', 'Danke! Mutter gibt dir ein Silberstück dafür. Oder zwei, wenn das Lamm ihr Brot nicht frisst.'],
        ['klebek', 'Ich verspreche nichts.'],
      ],
      rb: [
        ['narrator', 'Am Brunnen wird es still. Sogar die Esel hören auf zu schreien.'],
        ['dziewczyna', 'Wunderschön… Jetzt trägt sich der Krug von selbst.'],
      ],
    },
  },
};
