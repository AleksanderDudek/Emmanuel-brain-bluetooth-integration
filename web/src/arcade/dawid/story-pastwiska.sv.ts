/**
 * Dawid's story words: the pastures of Bethlehem, Swedish (from the Polish source, story-pastwiska.ts: the same
 * ids, speakers and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Den yngste av Isais åtta söner vaktar sin fars får på Betlehems kullar. Profeten Samuel är på väg till staden, och i snåret bortom bäcken lurar lejonet igen.',
  areas: {
    owczarnia: { name: 'Isais fårfålla', line: 'En stenmur, en taggig häck och hundra får som räknar med dig.' },
    studnia: { name: 'Brunnen vid porten', line: 'Betlehems brunn: det kallaste vattnet i hela Juda. Vid porten slumrar en gammal herde.' },
    potok: { name: 'Bäcken med släta stenar', line: 'En bäck full av runda stenar. Bortom den ett snår, och i snåret är det någon som ryter.' },
  },
  quests: {
    lamb: 'Hitta lammet som gått vilse i törnet',
    well: 'Prata med flickan vid brunnen',
    jar: 'Bär en kruka vatten till den gamle herden',
    asahel: 'Hitta Asael på kullen',
    ewe: 'Rädda tackan och lammet från vargarna',
  },
  things: {
    lamb: 'bortsprunget lamm',
    jar: 'kruka vatten',
  },
  scenes: {
    open: [
      ['narrator', 'Profeten Samuel kommer till Isais hus. Sju söner ställer sig framför honom.'],
      ['samuel', 'Inte heller han. Har du fler söner, Isai?'],
      ['jesse', 'Den yngste är kvar, David. Han vaktar fåren. Han luktar alltid får.'],
      ['narrator', 'David kommer springande från betet. Samuel smörjer honom med olja bland bröderna.'],
      ['eliab', 'Han? Fårpojken? Men det är ju jag som är längst!'],
      ['klebek', 'Nu luktar han olja. Och får. Men mest olja.'],
    ],
    lamb: [
      ['klebek', 'Hör du bräkandet? Det är inte jag. Jag bräker vackrare.'],
      ['narrator', 'I törnet sitter ett litet lamm, intrasslat upp till öronen. David trasslar försiktigt loss det.'],
      ['klebek', 'Välkommen till hjorden, lilla du. Regel ett: vi går inte in i törnet. Regel två: vi håller oss nära David.'],
    ],
    well: [
      ['dziewczyna', 'Var profeten hos er? Hela Betlehem pratar om det.'],
      ['dawid', 'Ja. Han åt kvällsmat med oss och gick. Och jag gick tillbaka till fåren.'],
      ['dziewczyna', 'Krukan är tung och hem är det långt. Det sägs att du spelar harpa också?'],
      ['klebek', 'Han spelar. Och han bär. Bara inte samtidigt.'],
    ],
    jar: [
      ['starzec', 'Vatten från brunnen vid porten… Min farfar drack det, och hans farfar. Tack av hela mitt hjärta.'],
      ['starzec', 'I natt såg jag vargar vid bäcken. Vakta fåren, de går efter de minsta.'],
      ['klebek', 'De minsta? Jag är minst! Nåja, nästan. Nu vaktar vi fåren.'],
    ],
    asahel: [
      ['asahel', 'Morbror! Jag hörde att profeten var hos morfar. Nu springer vi verkligen ikapp till lejonet!'],
      ['dawid', 'Till lejonet springer man inte ikapp, Asael. Till lejonet går man försiktigt.'],
      ['asahel', 'Försiktigt, men fort! Jag springer fortare än en gasell. Du får se.'],
      ['klebek', 'En springer som en gasell, en kastar som en storm. Och jag? Jag står för moralen.'],
    ],
    ewe: [
      ['narrator', 'Vargarna flyr in bland buskarna. En tacka och hennes lamm trycker sig mot Davids ben.'],
      ['klebek', 'Lugn, mamma. Det här är David. Han gör alltid så: kommer, kastar, vargarna försvinner.'],
      ['jesse', 'Du vaktar hjorden väl, David. Men från snåret hörs rytande. Lejonet är nära.'],
    ],
    end: [
      ['narrator', 'Lejonet får en sten på nosen och flyr upp i bergen. Fåren kommer tillbaka till betet, ett efter ett.'],
      ['jesse', 'Alla får är oskadda. Och Ulla?'],
      ['klebek', 'Också oskadd. Tack för att du frågar. Lite sent, men ändå.'],
      ['narrator', 'På kvällen kommer bud: kung Saul kan inte sova, och hans tjänare söker någon som spelar harpa.'],
      ['klebek', 'Du spelar harpa! Jag sjunger. Ungefär. Ska vi gå till bergen?'],
    ],
  },
  choices: {
    well: {
      a: 'Bär hennes kruka hem',
      b: 'Spela för henne på harpan',
      ra: [
        ['dziewczyna', 'Tack! Mamma ger dig ett silvermynt för det. Eller två, om lammet inte äter upp hennes bröd.'],
        ['klebek', 'Jag lovar ingenting.'],
      ],
      rb: [
        ['narrator', 'Det blir tyst vid brunnen. Till och med åsnorna slutar skria.'],
        ['dziewczyna', 'Så vackert… Nu bär krukan sig själv.'],
      ],
    },
  },
};
