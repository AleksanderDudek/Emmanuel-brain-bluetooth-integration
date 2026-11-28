/**
 * Dawid's story words: the hills of Judah, Swedish (from the Polish source, story-wzgorza.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Judas steniga berg, vingårdar på sluttningarna och en väg mot norr. Kung Saul kan inte sova om nätterna, och hans tjänare söker någon som kan spela harpa för honom.',
  areas: {
    winnice: { name: 'Vingårdarna på sluttningen', line: 'Terrasser med vinstockar, låga stenmurar och färska klövspår. Här har någon bökat i natt.' },
    trakt: { name: 'Kungsvägen', line: 'Vägen över bergen mot norr, till kungen. Damm, stenar och huggormar i dikena.' },
    przelecz: { name: 'Passet vid Sauls läger', line: 'Kungens tält på ena sidan, björnhonans ide på den andra. Vi går tyst.' },
  },
  quests: {
    sluga: 'Prata med kungens tjänare',
    vines: 'Försvara vingården mot vildsvinen',
    abiszaj: 'Hitta Abisai vid vägen',
    donkey: 'Led åsnan med gåvorna till kungen',
    harp: 'Spela harpa för kungen',
  },
  things: {
    donkey: 'åsna med gåvor',
  },
  scenes: {
    open: [
      ['narrator', 'Judas steniga berg. Druvorna mognar på terrasserna, och i gräset sover huggormar.'],
      ['kobieta', 'Vildsvin bökar upp min vingård! En natt till, och det blir bara pinnar kvar.'],
      ['klebek', 'Vildsvin? Stora? Med betar? Jag frågar bara av nyfikenhet. Vetenskaplig nyfikenhet.'],
      ['narrator', 'Och på kungsvägen frågar någon från hovet efter Isais son.'],
    ],
    sluga: [
      ['sluga', 'Jag söker Isais son. Är det du? Det sägs att du spelar harpa och inte är rädd för lejon.'],
      ['klebek', 'Det stämmer. Det är lejonet som är rädd för honom. Jag är beviset.'],
      ['sluga', 'Kung Saul kan inte sova om nätterna. En tung oro ligger över hans hjärta. Han behöver musik.'],
      ['dawid', 'Jag spelar för honom. Min far skickar gåvor till kungen med mig.'],
      ['sluga', 'Bra. Kungen väntar i lägret vid passet. Akta dig bara för vildsvinen på vägen.'],
    ],
    vines: [
      ['narrator', 'Det sista vildsvinet rusar in i buskarna, och hela familjen efter, från den största till den minsta.'],
      ['kobieta', 'Min vingård är räddad! Ta en korg druvor till vägen. Lammet får också smaka.'],
      ['klebek', 'Först en druva. För att kontrollera. Sedan resten, för säkerhets skull.'],
    ],
    abiszaj: [
      ['abiszaj', 'Morbror! Asael säger att du ska till kungen. Ensam? Med ett lamm? Utan sköld?'],
      ['dawid', 'Med en harpa, Abisai. Till en konsert tar man inte med sig sköld.'],
      ['abiszaj', 'Det gör jag alltid. Någon måste ju passa morbror. Jag följer med.'],
      ['klebek', 'En sköld större än han själv. Bra. Om något händer gömmer jag mig bakom den.'],
    ],
    donkey: [
      ['narrator', 'Isais åsna bär bröd och en getunge till kungen. Den går sakta och stannar vid varje tistel.'],
      ['klebek', 'Rör på dig, åsna! Kungen väntar! …Titta inte så på mig. Jag är också ett djur.'],
      ['narrator', 'Vid stenen vid vägskälet väntar kungens män. De tar emot gåvorna och för David vidare mot passet.'],
    ],
    harp: [
      ['narrator', 'Det är mörkt i kungens tält. Saul sitter med huvudet i händerna och har inte sovit på många nätter.'],
      ['saul', 'Spela. Kanske kan jag äntligen andas ut när du är här.'],
      ['narrator', 'David slår an strängarna. Melodin flyter stilla som en bäck om natten, och kungens axlar sjunker.'],
      ['saul', 'Stanna hos mig. Från och med nu bär du mina vapen.'],
      ['klebek', 'Kungens vapendragare! Och jag? Vapendragarens vapendragare? Jag kan bära… ost.'],
    ],
    end: [
      ['narrator', 'Björnhonan samlar ihop sina ungar och går djupt in i skogen. Passet är fritt.'],
      ['narrator', 'Över bergen kommer bud: filistéerna har slagit läger i Eladalen, mitt emot Sauls här.'],
      ['jesse', 'Dina tre bröder är i hären. Ta bröd och ostar till dem och kom tillbaka med besked om hur de har det.'],
      ['klebek', 'Ostar! Jag bär dem. Till första kröken. Sedan får vi se.'],
    ],
  },
  choices: {
    harp: {
      a: 'Spela herdarnas sång',
      b: 'Spela en stilla melodi',
      ra: [
        ['saul', 'Herdarnas sång… En gång letade jag efter min fars åsninnor i de här bergen.'],
        ['narrator', 'Kungen ler för första gången på många veckor.'],
      ],
      rb: [
        ['narrator', 'Strängarna viskar knappt. Det blir så tyst att man hör kungen andas. Saul somnar.'],
        ['klebek', 'Sch. Jag sover också. Nästan.'],
      ],
    },
  },
};
