/**
 * Dawid's story words: the Valley of Elah, Swedish (from the Polish source, story-ela.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Eladalen. Israels läger på ena sidan, filistéerna på den andra, och i mitten en jätte från Gat som har utmanat hela hären i fyrtio dagar.',
  areas: {
    oboz: { name: 'Israels läger', line: 'Tält på sluttningen, trossvagnar och lägereldar. Soldaterna ser ut som får i oväder.' },
    terebint: { name: 'Terebintdalen', line: 'En gammal terebint och en bäck i dalen. Här ligger de slätaste stenarna i hela Juda.' },
    pole: { name: 'Fältet mellan härarna', line: 'På andra sluttningen står filistéerna, och framför dem någon mycket, mycket stor.' },
  },
  quests: {
    bread: 'Ge Eliab bröd och ostar',
    soldiers: 'Prata med soldaterna',
    saul: 'Gå till kung Sauls tält',
    stones: 'Välj släta stenar ur bäcken',
    goliath: 'Gå ut mot jätten',
    jonatan: 'Jonatan väntar på dig',
  },
  things: {
    bread: 'bröd och ostar',
    stone: 'slät sten',
  },
  scenes: {
    open: [
      ['narrator', 'Eladalen. Israels tält på ena sluttningen, filistéerna på den andra, och en bäck emellan.'],
      ['narrator', 'Morgon och kväll kliver jätten från Gat ut ur filistéernas läger och skriker över hela dalen.'],
      ['goliat', 'Ge mig en man! En enda! I fyrtio dagar har jag väntat, och ingenting.'],
      ['klebek', 'Bää… Är det där en människa? Hans spjut är som en vävbom. Och jag har en ost.'],
    ],
    bread: [
      ['eliab', 'Och vad gör du här? Vem vaktar fåren? Du vill väl titta på striden, va?'],
      ['dawid', 'Jag frågar ju bara. Far skickar bröd och ostar.'],
      ['eliab', 'Ostar? …Hit med dem. Men du retar mig ändå.'],
      ['klebek', 'Eliab åt tre ostar. Jag åt smulorna. Rättvisa är en sällsynt gäst i den här dalen.'],
    ],
    soldiers: [
      ['zolnierz', 'Ser du honom? Det är Goljat från Gat. Lång som två män, och hans rustning väger som en åsna.'],
      ['zolnierz', 'Kungen har lovat: den som besegrar honom får rikedomar och kungens dotter, och hans släkt slipper skatt.'],
      ['klebek', 'Ingen skatt! Isai blir glad. Kanske gladare än för kungens dotter.'],
    ],
    saul: [
      ['saul', 'Så ung, och han har stridit sedan sin ungdom. Hur tänker du stå emot honom?'],
      ['dawid', 'Jag vaktar får, min kung. Lejonet och björnhonan trodde också att jag var liten.'],
      ['saul', 'Gå då. Men ta åtminstone min rustning och min hjälm.'],
    ],
    stones: [
      ['narrator', 'David lägger fem släta stenar ur bäcken i sin herdeväska. Bara fem.'],
      ['klebek', 'Varför fem? I reserv? Ifall jätten har bröder?'],
      ['dawid', 'En räcker. Räkna resten, så känner du dig lugnare.'],
    ],
    goliath: [
      ['goliat', 'Kommer du mot mig med en käpp? Är jag en hund? De skickar en herdepojke med småsten!'],
      ['klebek', 'Bää… han pratar med oss. Svara inte. Eller svara på långt håll.'],
      ['dawid', 'Du har svärd, spjut och en sköldbärare. Men jag kommer inte ensam.'],
      ['narrator', 'Framför jätten går en sköldbärare med en stor sköld. Stenarna studsar mot den med en skräll.'],
      ['klebek', 'Gå runt honom från sidan! Eller kasta den stora stenen: den flyger över skölden.'],
    ],
    jonatan: [
      ['narrator', 'Efter striden står David inför kungen med slungan i handen. Bredvid kungen står hans son Jonatan.'],
      ['jonatan', 'Ingen har någonsin tystat en jätte så. Från i dag är vi bröder.'],
      ['narrator', 'Jonatan tar av sig manteln, bältet och bågen och ger dem till David. De sluter ett vänskapsförbund.'],
      ['klebek', 'En prinsmantel! Så mjuk. Får jag också vara med i förbundet? Bara lite?'],
      ['jonatan', 'Du också, lamm. Du mest av alla.'],
    ],
    end: [
      ['narrator', 'Stenen från slungan träffar jätten i pannan. Goljat faller raklång, med ansiktet i gräset.'],
      ['narrator', 'Filistéerna flyr ur dalen, och Israels här går sjungande hem.'],
      ['eliab', 'Nåja… I dag vaktar jag fåren.'],
      ['klebek', 'En sten. En! Jag säger det till alla: en.'],
      ['narrator', 'Saul låter inte längre David gå hem till sin far. Han tar med honom till Gibea.'],
    ],
  },
  choices: {
    soldiers: {
      a: 'Vem är han, som skriker så?',
      b: 'Och vad får lammet?',
      ra: [
        ['zolnierz', 'Vem? En jätte. För en jätte är det skäl nog att skrika.'],
        ['dawid', 'Han skriker åt Guds folk. Han kommer inte att skrika länge till.'],
      ],
      rb: [
        ['zolnierz', 'Lammet? Hm… En skål linser, antagligen.'],
        ['klebek', 'Linser! Det tar jag. Nu går vi till jätten.'],
      ],
    },
    saul: {
      a: 'Prova kungens rustning',
      b: 'Tacka och behåll slungan',
      ra: [
        ['narrator', 'David tar två steg, skramlar som en gryta och tar av sig allt. I det här går det inte att gå.'],
        ['klebek', 'Det lät som ett kök före en fest. Gå hellre i tunikan.'],
      ],
      rb: [
        ['dawid', 'Tack, min kung. Men jag går i tunika, med stav och slunga.'],
        ['saul', 'Som du vill. Kom bara tillbaka hel.'],
      ],
    },
  },
};
