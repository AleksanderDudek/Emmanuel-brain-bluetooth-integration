/**
 * Dawid's story words: the Valley of Elah, German (from the Polish source, story-ela.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Das Tal Ela. Auf der einen Seite das Lager Israels, auf der anderen die Philister, und in der Mitte ein Riese aus Gat, der seit vierzig Tagen das ganze Heer herausfordert.',
  areas: {
    oboz: { name: 'Israels Lager', line: 'Zelte am Hang, Trosswagen und Lagerfeuer. Die Soldaten schauen wie Schafe im Gewitter.' },
    terebint: { name: 'Das Terebinthental', line: 'Eine alte Terebinthe und ein Bach im Tal. Hier liegen die glattesten Steine von ganz Juda.' },
    pole: { name: 'Das Feld zwischen den Heeren', line: 'Am anderen Hang stehen die Philister, und vor ihnen jemand sehr, sehr Großes.' },
  },
  quests: {
    bread: 'Bring Eliab Brot und Käse',
    soldiers: 'Sprich mit den Soldaten',
    saul: 'Geh zum Zelt von König Saul',
    stones: 'Such glatte Steine aus dem Bach',
    goliath: 'Geh dem Riesen entgegen',
    jonatan: 'Jonathan wartet auf dich',
  },
  things: {
    bread: 'Brot und Käse',
    stone: 'glatter Stein',
  },
  scenes: {
    open: [
      ['narrator', 'Das Tal Ela. Auf dem einen Hang die Zelte Israels, auf dem anderen die Philister, dazwischen ein Bach.'],
      ['narrator', 'Morgens und abends tritt der Riese aus Gat aus dem Lager der Philister und brüllt über das ganze Tal.'],
      ['goliat', 'Gebt mir einen Mann! Einen einzigen! Vierzig Tage warte ich schon, und nichts.'],
      ['klebek', 'Mäh… Das ist ein Mensch? Sein Speer ist wie ein Weberbaum. Und ich habe einen Käse.'],
    ],
    bread: [
      ['eliab', 'Und was machst du hier? Wer hütet die Schafe? Willst wohl der Schlacht zusehen, was?'],
      ['dawid', 'Ich frage doch nur. Vater schickt Brot und Käse.'],
      ['eliab', 'Käse? …Her damit. Aber du ärgerst mich trotzdem.'],
      ['klebek', 'Eliab hat drei Käse gegessen. Ich die Krümel. Gerechtigkeit ist ein seltener Gast in diesem Tal.'],
    ],
    soldiers: [
      ['zolnierz', 'Siehst du ihn? Das ist Goliath aus Gat. So groß wie zwei Männer, und seine Rüstung wiegt so viel wie ein Esel.'],
      ['zolnierz', 'Der König verspricht dem Sieger Reichtum und die Königstochter, und seine Familie zahlt keine Steuern mehr.'],
      ['klebek', 'Keine Steuern! Isai wird sich freuen. Vielleicht sogar mehr als über die Königstochter.'],
    ],
    saul: [
      ['saul', 'So jung, und er kämpft seit seiner Jugend. Wie willst du gegen ihn bestehen?'],
      ['dawid', 'Ich hüte Schafe, mein König. Der Löwe und die Bärin hielten mich auch für klein.'],
      ['saul', 'Dann geh. Aber nimm wenigstens meine Rüstung und meinen Helm.'],
    ],
    stones: [
      ['narrator', 'David steckt fünf glatte Steine aus dem Bach in seine Hirtentasche. Nur fünf.'],
      ['klebek', 'Warum fünf? Als Vorrat? Falls der Riese Brüder hat?'],
      ['dawid', 'Einer reicht. Zähl die anderen, damit du ruhiger bist.'],
    ],
    goliath: [
      ['goliat', 'Du kommst mit einem Stock zu mir? Bin ich ein Hund? Die schicken mir einen Hirtenjungen mit Kieseln!'],
      ['klebek', 'Mäh… er redet mit uns. Antworte nicht. Oder antworte von weitem.'],
      ['dawid', 'Du hast ein Schwert, einen Speer und einen Schildträger. Und ich komme nicht allein.'],
      ['narrator', 'Vor dem Riesen geht ein Schildträger mit einem großen Schild. Steine prallen scheppernd davon ab.'],
      ['klebek', 'Geh seitlich um ihn herum! Oder wirf den großen Stein: Der fliegt über den Schild.'],
    ],
    jonatan: [
      ['narrator', 'Nach der Schlacht steht David mit der Schleuder in der Hand vor dem König. Neben ihm steht sein Sohn Jonathan.'],
      ['jonatan', 'Noch nie hat jemand einem Riesen so den Mund gestopft. Von heute an sind wir Brüder.'],
      ['narrator', 'Jonathan legt Mantel, Gürtel und Bogen ab und schenkt sie David. Sie schließen einen Bund der Freundschaft.'],
      ['klebek', 'Der Mantel eines Prinzen! So weich. Darf ich auch im Bund sein? Wenigstens ein bisschen?'],
      ['jonatan', 'Du auch, Lamm. Du vor allem.'],
    ],
    end: [
      ['narrator', 'Der Stein aus der Schleuder trifft den Riesen an der Stirn. Goliath fällt der Länge nach ins Gras.'],
      ['narrator', 'Die Philister fliehen aus dem Tal, und Israels Heer zieht singend nach Hause.'],
      ['eliab', 'Na gut… Heute hüte ich die Schafe.'],
      ['klebek', 'Ein Stein. Einer! Ich sage es allen: einer.'],
      ['narrator', 'Saul lässt David nicht mehr zu seinem Vater zurück. Er nimmt ihn mit nach Gibea.'],
    ],
  },
  choices: {
    soldiers: {
      a: 'Wer ist er, dass er so brüllt?',
      b: 'Und was bekommt das Lamm?',
      ra: [
        ['zolnierz', 'Wer? Ein Riese. Für einen Riesen ist das Grund genug zu brüllen.'],
        ['dawid', 'Er brüllt Gottes Volk an. Lange wird er nicht mehr brüllen.'],
      ],
      rb: [
        ['zolnierz', 'Das Lamm? Hm… Wohl eine Schüssel Linsen.'],
        ['klebek', 'Linsen! Abgemacht. Auf zum Riesen.'],
      ],
    },
    saul: {
      a: 'Probier die Rüstung an',
      b: 'Dank ihm, bleib bei der Schleuder',
      ra: [
        ['narrator', 'David macht zwei Schritte, scheppert wie ein Topf und zieht alles wieder aus. Darin kann man nicht gehen.'],
        ['klebek', 'Das klang wie eine Küche vor dem Festmahl. Geh lieber im Hemd.'],
      ],
      rb: [
        ['dawid', 'Danke, mein König. Aber ich gehe im Hemd, mit Stab und Schleuder.'],
        ['saul', 'Wie du willst. Komm nur heil zurück.'],
      ],
    },
  },
};
