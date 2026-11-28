/**
 * Dawid's story words: the fields of Gibeah, Swedish (from the Polish source, story-gibea.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Gibea, kung Sauls stad. Kvinnorna sjunger högre om David än om kungen, och kungen ser allt mörkare på det. Bara Jonatan står kvar vid sin väns sida.',
  areas: {
    pola: { name: 'Kornfälten', line: 'Korn upp till midjan, åkerrenar och stigar. Unga uroxar tycker också att korn är gott.' },
    mury: { name: 'Gibeas murar', line: 'Murarna kring kungens stad och i muren Mikals fönster. Högt upp. Väldigt högt upp.' },
    ezel: { name: 'Stenen Esel', line: 'En stor sten mitt på fältet. Ett bra ställe att gömma sig på. Och att vänta.' },
  },
  quests: {
    women: 'Lyssna på kvinnornas sång',
    rope: 'Hitta ett starkt rep',
    mikal: 'Gå till Mikals fönster',
    barley: 'Skydda änkans korn mot vildsvinen',
    ezel: 'Möt Jonatan vid stenen Esel',
    arrows: 'Hämta Jonatans pilar',
    farewell: 'Ta farväl av Jonatan',
  },
  things: {
    rope: 'starkt rep',
    arrow: 'pil från Jonatan',
  },
  scenes: {
    open: [
      ['narrator', 'Gibea, kung Sauls stad. David bor nu vid hovet och drar ut med hären.'],
      ['jonatan', 'Vart min far än sänder dig lyckas du. Folket älskar dig. Det gör jag också.'],
      ['narrator', 'Men kungen ser allt mörkare på David och griper allt oftare efter sitt spjut.'],
      ['klebek', 'Jag tycker inte om det där spjutet. Det är för nära och för ofta.'],
    ],
    women: [
      ['narrator', 'Ur städerna kommer kvinnor med tamburiner och dansar för att välkomna hären.'],
      ['narrator', 'De sjunger att Saul har sina tusen och David sina tiotusen. Kungen lyssnar och mörknar.'],
      ['saul', 'Tiotusen åt honom, tusen åt mig. Nu fattas honom bara kungariket.'],
      ['narrator', 'Nästa dag, när David spelar, kastar kungen sitt spjut. Det fastnar i väggen. David viker undan.'],
      ['klebek', 'Bää! Det där var ingen ton! Det var ett spjut!'],
    ],
    rope: [
      ['narrator', 'Under muren, i en höstack, ligger ett långt och starkt rep. Precis ett sådant som behövs.'],
      ['mikal', 'David, min fars män står utanför dörren. Om du inte kommer undan i natt är det för sent i morgon.'],
      ['klebek', 'Ett rep, en mur, ett fönster och natten. Jag har en dålig känsla. Och höjdskräck.'],
    ],
    mikal: [
      ['narrator', 'Mikal, kungens dotter och Davids hustru, knyter fast repet i fönstret mot muren.'],
      ['mikal', 'Jag lägger en docka i sängen med en kudde av gethår. Jag säger att du har feber.'],
      ['klebek', 'En docka av gethår? Den blir mer lik mig än dig.'],
    ],
    barley: [
      ['narrator', 'Vildsvinen springer grymtande från fältet.'],
      ['kobieta', 'Mitt korn! Allt är kvar! Jag har ingen man och ingen son, bara det här fältet. Tack.'],
      ['klebek', 'Fältet räddat, änkan glad, vildsvinen stötta. Så vill jag ha det.'],
    ],
    ezel: [
      ['jonatan', 'I morgon är det nymåne och fest hos min far. Din plats vid bordet blir tom. Jag ska se vad han säger.'],
      ['jonatan', 'Göm dig vid den här stenen. Jag skjuter tre pilar och skickar en pojke att hämta dem.'],
      ['jonatan', 'Ropar jag: ”Pilarna ligger hitom”, kom tillbaka i frid. Ropar jag: ”Längre bort”, fly.'],
      ['klebek', 'En enkel plan. Jag gillar enkla planer. Så länge ingen siktar på lamm.'],
    ],
    arrows: [
      ['chlopiec', 'Tre pilar! Tack. Jag hade letat efter dem till kvällen.'],
      ['jonatan', 'Den sista flög längre bort… Mycket längre än jag ville.'],
      ['narrator', 'David förstår tecknet. Längre bort betyder: fly. Kungen vill honom ont.'],
      ['klebek', 'Jag tycker inte om orden ”längre bort”. De är sorgliga. Och långt borta.'],
    ],
    farewell: [
      ['narrator', 'Pojken går tillbaka till staden med pilarna. David kommer fram bakom stenen.'],
      ['narrator', 'Vännerna omfamnar varandra och gråter. David gråter mest.'],
      ['jonatan', 'Gå i frid. Vad som än händer förblir vi vänner: vi och våra barn.'],
      ['dawid', 'Det här glömmer jag aldrig, Jonatan. Aldrig.'],
      ['klebek', 'Jag gråter inte. Det är damm. Åkerdamm.'],
    ],
    end: [
      ['narrator', 'Storuroxen fnyser och dundrar bort över stäppen. Vägen söderut, till öknen, ligger öppen.'],
      ['klebek', 'Vägen är fri. Men innan vi går… Jonatan väntar vid stenen.'],
      ['narrator', 'David vet vad den sista pilen betydde. Han går för att ta farväl.'],
    ],
  },
  choices: {
    mikal: {
      a: 'Klättra ner för repet',
      b: 'Lammet först, i en korg',
      ra: [
        ['narrator', 'David glider ner för repet och försvinner i mörkret. Mikal vinkar från fönstret.'],
      ],
      rb: [
        ['klebek', 'I en korg? Jag? …Okej. Men sakta. Och jag tittar inte ner.'],
        ['narrator', 'Korgen med lammet åker ner först, sedan David. Ingen hör ett ljud.'],
      ],
    },
  },
};
