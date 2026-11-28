/**
 * Dawid's story words: the fields of Gibeah, German (from the Polish source, story-gibea.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const DE: LandWords = {
  chapter: 'Gibea, die Stadt König Sauls. Die Frauen singen lauter von David als vom König, und der König sieht es immer finsterer. Nur Jonathan steht zu seinem Freund.',
  areas: {
    pola: { name: 'Die Gerstenfelder', line: 'Gerste bis zur Hüfte, Feldraine und Pfade. Auch junge Auerochsen finden Gerste köstlich.' },
    mury: { name: 'Die Mauern von Gibea', line: 'Die Mauern der Königsstadt und darin das Fenster von Michals Haus. Hoch. Sehr hoch.' },
    ezel: { name: 'Der Stein Ezel', line: 'Ein großer Stein mitten im Feld. Ein guter Ort, um sich zu verstecken. Und um zu warten.' },
  },
  quests: {
    women: 'Hör das Lied der Frauen',
    rope: 'Finde ein starkes Seil',
    mikal: 'Geh unter Michals Fenster',
    barley: 'Schütz die Gerste der Witwe vor den Keilern',
    ezel: 'Triff Jonathan am Stein Ezel',
    arrows: 'Bring Jonathans Pfeile zurück',
    farewell: 'Nimm Abschied von Jonathan',
  },
  things: {
    rope: 'starkes Seil',
    arrow: 'Jonathans Pfeil',
  },
  scenes: {
    open: [
      ['narrator', 'Gibea, die Stadt König Sauls. David lebt jetzt am Hof und zieht mit dem Heer aus.'],
      ['jonatan', 'Wohin mein Vater dich auch schickt, es gelingt dir. Das Volk liebt dich. Ich auch.'],
      ['narrator', 'Doch der König sieht David immer finsterer an und greift immer öfter nach seinem Speer.'],
      ['klebek', 'Dieser Speer gefällt mir nicht. Er ist zu nah und zu oft da.'],
    ],
    women: [
      ['narrator', 'Aus den Städten kommen Frauen mit Pauken und tanzen dem Heer zum Empfang.'],
      ['narrator', 'Sie singen, Saul habe seine Tausende und David seine Zehntausende. Der König hört zu und wird finster.'],
      ['saul', 'Ihm Zehntausende, mir Tausende. Jetzt fehlt ihm nur noch das Königreich.'],
      ['narrator', 'Am nächsten Tag, als David spielt, schleudert der König den Speer. Er fährt in die Wand. David weicht aus.'],
      ['klebek', 'Mäh! Das war keine Note! Das war ein Speer!'],
    ],
    rope: [
      ['narrator', 'Unter der Mauer, in einem Heuhaufen, liegt ein langes, starkes Seil. Genau so eins, wie man es braucht.'],
      ['mikal', 'David, die Männer meines Vaters stehen vor der Tür. Wenn du heute Nacht nicht fliehst, ist es morgen zu spät.'],
      ['klebek', 'Ein Seil, eine Mauer, ein Fenster und die Nacht. Ich habe ein ungutes Gefühl. Und Höhenangst.'],
    ],
    mikal: [
      ['narrator', 'Michal, die Tochter des Königs und Davids Frau, bindet das Seil im Fenster zur Mauer hin fest.'],
      ['mikal', 'Ich lege eine Puppe ins Bett, mit einem Kissen aus Ziegenhaar. Ich sage, du hast Fieber.'],
      ['klebek', 'Eine Puppe aus Ziegenhaar? Die sieht mir ähnlicher als dir.'],
    ],
    barley: [
      ['narrator', 'Die Keiler laufen quiekend vom Feld.'],
      ['kobieta', 'Meine Gerste! Alles noch da! Ich habe keinen Mann und keinen Sohn, nur dieses Feld. Danke dir.'],
      ['klebek', 'Feld gerettet, Witwe glücklich, Keiler beleidigt. So mag ich das.'],
    ],
    ezel: [
      ['jonatan', 'Morgen ist Neumond und das Festmahl bei meinem Vater. Dein Platz bleibt leer. Ich sehe, was er sagt.'],
      ['jonatan', 'Versteck dich bei diesem Stein. Ich schieße drei Pfeile und schicke einen Jungen, sie zu holen.'],
      ['jonatan', 'Rufe ich: „Die Pfeile liegen diesseits“, komm in Frieden zurück. Rufe ich: „Weiter“, dann flieh.'],
      ['klebek', 'Ein einfacher Plan. Ich mag einfache Pläne. Solange keiner auf Lämmer zielt.'],
    ],
    arrows: [
      ['chlopiec', 'Drei Pfeile! Danke. Ich hätte sie bis zum Abend gesucht.'],
      ['jonatan', 'Der letzte flog weiter… Viel weiter, als ich wollte.'],
      ['narrator', 'David versteht das Zeichen. Weiter heißt: flieh. Der König will ihn verderben.'],
      ['klebek', 'Ich mag das Wort „weiter“ nicht. Es ist traurig. Und weit.'],
    ],
    farewell: [
      ['narrator', 'Der Junge geht mit den Pfeilen in die Stadt zurück. David kommt hinter dem Stein hervor.'],
      ['narrator', 'Die Freunde fallen sich in die Arme und weinen. David weint noch mehr.'],
      ['jonatan', 'Geh in Frieden. Was auch geschieht, wir bleiben Freunde: wir und unsere Kinder.'],
      ['dawid', 'Das vergesse ich dir nie, Jonathan. Niemals.'],
      ['klebek', 'Ich weine nicht. Das ist Staub. Feldstaub.'],
    ],
    end: [
      ['narrator', 'Der große Auerochse schnaubt und donnert in die Steppe davon. Der Weg nach Süden, in die Wüste, ist frei.'],
      ['klebek', 'Der Weg ist frei. Aber bevor wir gehen… Jonathan wartet am Stein.'],
      ['narrator', 'David weiß, was der letzte Pfeil bedeutet. Er geht, um Abschied zu nehmen.'],
    ],
  },
  choices: {
    mikal: {
      a: 'Kletter am Seil hinunter',
      b: 'Erst das Lamm, im Korb',
      ra: [
        ['narrator', 'David gleitet am Seil hinab und verschwindet in der Dunkelheit. Michal winkt aus dem Fenster.'],
      ],
      rb: [
        ['klebek', 'Im Korb? Ich? …Na gut. Aber langsam. Und ich schaue nicht nach unten.'],
        ['narrator', 'Der Korb mit dem Lamm fährt zuerst hinunter, dann David. Niemand hört etwas.'],
      ],
    },
  },
};
