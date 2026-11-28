/**
 * Dawid's story words: the land of Gath, German (from the Polish source, story-gat.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Das Land Gat, die Heimat der Riesen. Hier, bei den Philistern, sucht David Zuflucht vor Saul. Nicht jeder Philister ist ein Feind, und einer wird ein Freund.',
  areas: {
    brama: { name: 'Das Tor von Gat', line: 'Die hohen Tore der Stadt und Wachen mit Federbüschen. Hinter dem Tor wohnt König Achisch.' },
    ziklag: { name: 'Ziklag', line: 'Ein Städtchen am Wüstenrand: niedrige Mauern, ein Brunnen, Raum für sechshundert Familien.' },
    obozowisko: { name: 'Das Lager der Riesen', line: 'Zelte groß wie Scheunen und Speere dick wie Balken. Hier ist jemand sehr groß.' },
  },
  quests: {
    itaj: 'Lern Ittai aus Gat kennen',
    achisz: 'Tritt vor König Achisch',
    ziklag: 'Kehr nach Ziklag zurück',
    flock: 'Rette die Herden vor den Wölfen',
    families: 'Bring die Familien nach Hause',
    szamma: 'Schamma verteidigt das Linsenfeld',
  },
  things: {
    flock: 'Herde von Ziklag',
    families: 'Familien von Ziklag',
  },
  scenes: {
    open: [
      ['narrator', 'Das Land Gat, die Heimat der Riesen. David kommt hierher, um sich vor Saul zu verstecken.'],
      ['klebek', 'Zu den Philistern? Zu den Riesen? Ich habe eine Frage: Essen die Lämmer?'],
      ['abiszaj', 'Nicht alle, Lamm. Aber bleib dicht beim Onkel.'],
    ],
    itaj: [
      ['itaj', 'Willkommen in Gat! Ich bin Ittai. Bei uns ist nicht jeder ein Riese. Ich zum Beispiel bin ein Freund.'],
      ['itaj', 'Aber sei vorsichtig. Die Diener von König Achisch kennen das Lied von den Zehntausenden.'],
      ['klebek', 'Dieses Lied ist überall vor uns da. Es ist schneller als Asahel.'],
      ['dawid', 'Danke, Ittai. Ich gebe acht.'],
    ],
    achisz: [
      ['narrator', 'Die Diener bringen David vor König Achisch. David hat Angst, also stellt er sich wahnsinnig.'],
      ['achisz', 'Das soll der große David sein? Der aus dem Lied?'],
      ['klebek', 'Spiel den Verrückten. Ich spiele das verdutzte Lamm. Das kann ich am besten.'],
    ],
    ziklag: [
      ['narrator', 'Jahre vergehen. David kehrt mit sechshundert Männern nach Gat zurück, und Achisch schenkt ihm Ziklag.'],
      ['narrator', 'Eines Tages kommt David nach drei Tagen Weg nach Hause. Ziklag ist verbrannt und leer.'],
      ['abiszaj', 'Räuber aus der Wüste holten Frauen, Kinder und alle Habe. Keinem ist etwas geschehen, aber alle sind fort.'],
      ['narrator', 'Die Männer weinen, bis sie keine Kraft mehr haben. Manche sehen David voller Zorn an.'],
      ['narrator', 'David bleibt eine Weile allein, in der Stille, mit Gott. Dann steht er auf.'],
      ['dawid', 'Steht auf. Wir gehen ihnen nach. Wir holen alles zurück.'],
    ],
    flock: [
      ['narrator', 'Die Wölfe fliehen in die Wüste. Die Schafe und Ziegen von Ziklag stehen beisammen, heil und gesund.'],
      ['klebek', 'Schafe! Echte Schafe! Nach all den Ländern fühle ich mich wie zu Hause.'],
      ['abiszaj', 'Die Herden sind zurück. Jetzt die Familien.'],
    ],
    families: [
      ['narrator', 'Die Räuber fliehen auf Kamelen und lassen alles zurück, was sie mitgenommen haben.'],
      ['narrator', 'Die Familien kehren nach Ziklag zurück. Niemand fehlt, vom Jüngsten bis zum Ältesten.'],
      ['abigail', 'Alle sind da. Alle! Sogar die Ziege der Nachbarin.'],
      ['dawid', 'Die am Bach Besor haben das Gepäck bewacht. Sie bekommen so viel wie wir. Wir teilen gleich.'],
      ['klebek', 'Gleich! Also bekomme ich auch Käse. Endlich ist die Gerechtigkeit in der Wüste angekommen.'],
    ],
    szamma: [
      ['szamma', 'Halt! Das ist ein Linsenfeld. Ich gebe es nicht her. Nicht den Wölfen, nicht den Riesen. Niemandem.'],
      ['dawid', 'Niemand will es dir nehmen, Schamma. Wir wollen helfen.'],
      ['szamma', 'Helfen? Linsen verteidigen? …Das ändert die Lage. Ich komme mit.'],
      ['klebek', 'Linsen! Ich habe ja gesagt, die sind mal nützlich. Hab ich nicht? Dann sage ich es jetzt.'],
    ],
    end: [
      ['narrator', 'Der Riese aus Gat fällt der Länge nach hin, und sein Lager zerstreut sich über die Hügel.'],
      ['narrator', 'In Ziklag brennen wieder Feuer. Von der Beute schickt David den Ältesten Judas, seinen Nachbarn, Geschenke.'],
      ['itaj', 'Ich bin ein Philister, aber ich gehe mit dir. Was auch kommt.'],
      ['narrator', 'Bald werden die Männer Judas in Hebron David zum König salben. Aber das ist eine andere Geschichte.'],
      ['klebek', 'Weißt du noch, der Schafstall? Schakale, Dornen, der Löwe. Dort hat der ganze Weg begonnen.'],
      ['klebek', 'Jetzt noch einmal, von den Weiden an. Du mit der Schleuder, ich mit Ratschlägen. Lass dich nur nicht fressen.'],
    ],
  },
  choices: {
    achisz: {
      a: 'Kritzel an das Tor',
      b: 'Sing ein albernes Lied',
      ra: [
        ['narrator', 'David kratzt an den Torflügeln und lässt Speichel in den Bart laufen. Die Wachen weichen zurück.'],
        ['achisz', 'Habe ich in Gat zu wenig Verrückte? Schafft ihn hinaus!'],
      ],
      rb: [
        ['dawid', 'Mäh, mäh, ein Riese mit Hut, mäh!'],
        ['achisz', 'Habe ich in Gat zu wenig Verrückte? Schafft ihn hinaus!'],
      ],
    },
  },
};
