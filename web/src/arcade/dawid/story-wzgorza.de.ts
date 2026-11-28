/**
 * Dawid's story words: the hills of Judah, German (from the Polish source, story-wzgorza.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Die steinigen Hügel Judas, Weinberge an den Hängen und eine Straße nach Norden. König Saul kann nachts nicht schlafen, und seine Diener suchen jemanden, der ihm auf der Harfe spielt.',
  areas: {
    winnice: { name: 'Die Weinberge am Hang', line: 'Terrassen mit Reben, Steinmauern und frische Hufspuren. Hier hat nachts jemand gewühlt.' },
    trakt: { name: 'Die Königsstraße', line: 'Die Straße über die Berge nach Norden, zum König. Staub, Steine und Vipern in den Gräben.' },
    przelecz: { name: 'Der Pass bei Sauls Lager', line: 'Hier die Zelte des Königs, dort die Höhle der Bärin. Jetzt ganz leise.' },
  },
  quests: {
    sluga: 'Sprich mit dem Diener des Königs',
    vines: 'Schütze den Weinberg vor den Keilern',
    abiszaj: 'Finde Abisai am Weg',
    donkey: 'Führ den Esel mit den Gaben zum König',
    harp: 'Spiel dem König auf der Harfe',
  },
  things: {
    donkey: 'Esel mit Gaben',
  },
  scenes: {
    open: [
      ['narrator', 'Die steinigen Hügel Judas. Auf den Terrassen reifen Trauben, und im Gras schlafen Vipern.'],
      ['kobieta', 'Keiler wühlen meinen Weinberg um! Noch eine Nacht, und es bleiben nur Stöcke.'],
      ['klebek', 'Keiler? Große? Mit Hauern? Ich frage nur aus Neugier. Wissenschaftlicher Neugier.'],
      ['narrator', 'Und auf der Königsstraße fragt jemand vom Hof nach Isais Sohn.'],
    ],
    sluga: [
      ['sluga', 'Ich suche Isais Sohn. Bist du das? Es heißt, du spielst Harfe und hast keine Angst vor Löwen.'],
      ['klebek', 'Stimmt. Der Löwe hat Angst vor ihm. Ich bin der Beweis.'],
      ['sluga', 'König Saul kann nachts nicht schlafen. Eine schwere Unruhe liegt ihm auf dem Herzen. Er braucht Musik.'],
      ['dawid', 'Ich spiele für ihn. Mein Vater schickt Gaben für den König mit.'],
      ['sluga', 'Gut. Der König wartet im Lager am Pass. Pass unterwegs nur auf die Keiler auf.'],
    ],
    vines: [
      ['narrator', 'Der letzte Keiler flitzt ins Gebüsch, und die ganze Familie hinterher, vom größten bis zum kleinsten.'],
      ['kobieta', 'Mein Weinberg ist gerettet! Nehmt einen Korb Trauben für den Weg. Das Lamm darf auch probieren.'],
      ['klebek', 'Erst eine Traube. Zur Probe. Dann den Rest, zur Sicherheit.'],
    ],
    abiszaj: [
      ['abiszaj', 'Onkel! Asahel sagt, du gehst zum König. Allein? Mit einem Lamm? Ohne Schild?'],
      ['dawid', 'Mit einer Harfe, Abisai. Zu einem Konzert nimmt man keinen Schild mit.'],
      ['abiszaj', 'Ich schon, immer. Einer muss ja auf den Onkel aufpassen. Ich komme mit.'],
      ['klebek', 'Ein Schild, größer als er. Gut. Wenn etwas ist, verstecke ich mich dahinter.'],
    ],
    donkey: [
      ['narrator', 'Isais Esel trägt Brot und ein Böckchen für den König. Er geht langsam und hält an jeder Distel.'],
      ['klebek', 'Beweg dich, Esel! Der König wartet! …Schau mich nicht so an. Ich bin auch ein Tier.'],
      ['narrator', 'Am Stein an der Wegkreuzung warten die Leute des Königs. Sie nehmen die Gaben und führen David zum Pass.'],
    ],
    harp: [
      ['narrator', 'Im Zelt des Königs ist es dunkel. Saul sitzt, den Kopf in den Händen, und schläft seit vielen Nächten nicht.'],
      ['saul', 'Spiel. Vielleicht kann ich bei dir endlich aufatmen.'],
      ['narrator', 'David zupft die Saiten. Die Melodie fließt leise wie ein Bach bei Nacht, und die Schultern des Königs sinken.'],
      ['saul', 'Bleib bei mir. Von jetzt an trägst du meine Waffen.'],
      ['klebek', 'Der Waffenträger des Königs! Und ich? Der Waffenträger des Waffenträgers? Ich kann… Käse tragen.'],
    ],
    end: [
      ['narrator', 'Die Bärin nimmt ihre Jungen und verschwindet tief im Wald. Der Pass ist frei.'],
      ['narrator', 'Über die Berge kommt Nachricht: Die Philister lagern im Tal Ela, gegenüber Sauls Heer.'],
      ['jesse', 'Deine drei Brüder sind beim Heer. Bring ihnen Brot und Käse und sag mir, wie es ihnen geht.'],
      ['klebek', 'Käse! Ich trage ihn. Bis zur ersten Kurve. Dann sehen wir weiter.'],
    ],
  },
  choices: {
    harp: {
      a: 'Spiel das Lied der Hirten',
      b: 'Spiel eine leise Melodie',
      ra: [
        ['saul', 'Das Lied der Hirten… Einst habe ich in diesen Bergen die Eselinnen meines Vaters gesucht.'],
        ['narrator', 'Der König lächelt zum ersten Mal seit vielen Wochen.'],
      ],
      rb: [
        ['narrator', 'Die Saiten flüstern kaum. Es wird so still, dass man den König atmen hört. Saul schläft ein.'],
        ['klebek', 'Pst. Ich schlafe auch. Fast.'],
      ],
    },
  },
};
