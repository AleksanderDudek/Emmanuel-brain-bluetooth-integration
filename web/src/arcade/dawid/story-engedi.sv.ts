/**
 * Dawid's story words: the wilderness of En-Gedi, Swedish (from the Polish source, story-engedi.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Saul jagar David genom hela öknen med tretusen utvalda män. David och hans fyrahundra gömmer sig bland En-Gedis klippor, där en källa porlar och stenbockar hoppar.',
  areas: {
    skaly: { name: 'Stenbocksklipporna', line: 'Klippavsatser, stenbockar på hyllorna, karakaler i skrevorna. Se var du sätter fötterna.' },
    jaskinia: { name: 'Grottan vid fårfållorna', line: 'Fårfållor av sten vid vägen och bakom dem en mörk grottöppning. Svalt och tyst där inne.' },
    zrodlo: { name: 'En-Gedis källa', line: 'Vatten faller från en hög klippa bland palmer och vass. Öknens vackraste plats.' },
  },
  quests: {
    achimelek: 'Gå till prästen Ahimelek i Nob',
    benajasz: 'Hitta Benaja',
    cave: 'Göm dig i grottan',
    call: 'Ropa efter kungen från kullen',
    water: 'Fyll vattensäckarna i grottan',
    abigail: 'Gå Abigail till mötes',
    kid: 'Rädda getungen från karakalerna',
  },
  things: {
    water: 'vattensäck',
    kid: 'getunge',
    corner: 'flik av manteln',
  },
  scenes: {
    open: [
      ['narrator', 'I Adullams grotta samlas Davids bröder hos honom, och efter dem de nödställda, de skuldsatta och de bittra.'],
      ['klebek', 'Fyrahundra nya vänner! Jag hoppas att ingen av dem gillar lammstek.'],
      ['narrator', 'Med dem drar David ut i En-Gedis öken vid Salthavet. Kung Saul letar efter honom överallt.'],
      ['abiszaj', 'Morbror, fyrahundra man och en källa. Vi behöver vatten, bröd och lite lugn.'],
      ['klebek', 'Och ost. Fyrahundra ostar. Okej, trehundra. Jag äter ju nästan ingenting.'],
    ],
    achimelek: [
      ['narrator', 'Hungrig och utan vapen kommer David till Nob, prästernas stad. Hans män väntar i gömstället.'],
      ['achimelek', 'Ensam? Utan dina män? Vad har hänt?'],
      ['dawid', 'Ett brådskande ärende, präst. Har du lite bröd till vägen?'],
      ['achimelek', 'Bara skådebröden, tagna från bordet i dag. Ta dem, och jättens svärd, inlindat i en mantel.'],
      ['klebek', 'Goljats svärd? Dubbelt så långt som jag. Och tyngre än vi båda.'],
    ],
    benajasz: [
      ['benajasz', 'Jag är Benaja. Jag hör att du samlar män som inte är rädda.'],
      ['klebek', 'Är du inte rädd? För någonting? Inte ens för ett lejon?'],
      ['benajasz', 'En snöig dag steg jag en gång ner i en grop där ett lejon satt. Och jag kom upp ensam.'],
      ['klebek', 'Jag var en gång i ett lejons gap. Jag kom ut också. Med hjälp. Vi har något gemensamt.'],
    ],
    cave: [
      ['narrator', 'Saul och hans här stannar vid fårfållorna. Han går ensam in i grottan och vet inte vem som sitter längst in.'],
      ['abiszaj', 'Morbror, det är han! Ensam, utan vakter. Ett sådant ögonblick kommer aldrig igen.'],
      ['dawid', 'Jag lyfter inte min hand mot kungen. Det är inte min sak att döma honom.'],
      ['klebek', 'Sch. Han vilar. Vi andas tyst. Mycket tyst.'],
    ],
    call: [
      ['narrator', 'Saul går ut ur grottan och går sin väg. David springer upp på kullen efter honom och ropar.'],
      ['dawid', 'Min herre och kung! Jag var alldeles bredvid dig i grottan, och jag lyfte inte min hand mot dig.'],
      ['saul', 'David? Är det du? …Min son, det finns mer gott i ditt hjärta än i mitt.'],
      ['narrator', 'Saul gråter. Sedan vänder han hem med sin här.'],
      ['klebek', 'Kungen gråter, jag gråter, till och med stenbockarna har blöta ögon. En bra dag.'],
    ],
    water: [
      ['narrator', 'Från grottans tak droppar vatten, droppe för droppe. Tre vattensäckar är fulla.'],
      ['abiszaj', 'Droppe för droppe, och männen har något att dricka. Bra jobbat, morbror.'],
      ['klebek', 'Jag tog bara en klunk. En stor. En mycket stor. Men en.'],
    ],
    abigail: [
      ['narrator', 'Rike Nabal från Karmel skickade bort Davids män tomhänta, fast de vaktat hans hjordar. David blir vred.'],
      ['narrator', 'Men längs vägen kommer Abigail, Nabals hustru, ridande på en åsna med bröd, russin och fikonkakor.'],
      ['abigail', 'Min herre, bry dig inte om Nabal. Hans namn betyder ”dåre”, och det är vad han är.'],
      ['abigail', 'Ta inte på dig en orätt som du sedan skulle ångra. Tag emot de här gåvorna.'],
      ['dawid', 'Tack för din klokhet. Du håller mig tillbaka från ett dåligt steg.'],
      ['klebek', 'Fikonkakor! Hon vet hur man pratar med ett följe.'],
    ],
    kid: [
      ['narrator', 'Karakalerna flyr in i skrevorna. På en klipphylla darrar en liten getunge.'],
      ['klebek', 'Lugn, lilla du. Jag var också i knipa en gång. Nu går jag med David, och allt är bra.'],
      ['narrator', 'Getungen hoppar till sin mamma. Stengeten ser länge på David, sedan försvinner båda bland klipporna.'],
    ],
    end: [
      ['narrator', 'Leoparden hoppar upp på klippan och försvinner bakom åsen. Stigen västerut, till Gats land, är öppen.'],
      ['dawid', 'Saul slutar inte leta efter mig. Jag går dit där han inte letar: till filistéerna.'],
      ['abigail', 'Vi följer med dig. Förrådet räcker för vägen.'],
      ['klebek', 'Till Gat? Där jättarna bor? Okej. Men jag går mitt i följet.'],
    ],
  },
  choices: {
    cave: {
      a: 'Skär av en flik av manteln',
      b: 'Dra dig tyst tillbaka',
      ra: [
        ['narrator', 'David skär av en flik av kungens mantel. Saul märker ingenting.'],
        ['klebek', 'En flik av en mantel. Den dyraste lappen i hela Israel.'],
      ],
      rb: [
        ['narrator', 'David drar sig tillbaka in i mörkret. Saul reser sig, rättar till manteln och går ut utan att ana något.'],
        ['klebek', 'Ingen vet hur nära det var. Bara vi. Och det räcker.'],
      ],
    },
  },
};
