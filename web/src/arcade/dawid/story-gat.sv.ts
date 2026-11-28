/**
 * Dawid's story words: the land of Gath, Swedish (from the Polish source, story-gat.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const SV: LandWords = {
  chapter: 'Gats land, jättarnas hem. Här, bland filistéerna, söker David skydd undan Saul. Inte varje filisté är en fiende, och en av dem blir en vän.',
  areas: {
    brama: { name: 'Gats port', line: 'Stadens höga portar och vakter med fjäderbuskar. Bakom porten bor kung Akis.' },
    ziklag: { name: 'Siklag', line: 'En liten stad i öknens utkant: låga murar, en brunn och hus för sexhundra familjer.' },
    obozowisko: { name: 'Jättarnas läger', line: 'Tält stora som lador och spjut tjocka som bjälkar. Någon här är väldigt stor.' },
  },
  quests: {
    itaj: 'Lär känna Ittai från Gat',
    achisz: 'Träd fram inför kung Akis',
    ziklag: 'Gå tillbaka till Siklag',
    flock: 'Rädda hjordarna från vargarna',
    families: 'Följ familjerna hem',
    szamma: 'Samma försvarar linsfältet',
  },
  things: {
    flock: 'hjorden från Siklag',
    families: 'familjerna från Siklag',
  },
  scenes: {
    open: [
      ['narrator', 'Gats land, jättarnas hem. David kommer hit för att gömma sig för Saul.'],
      ['klebek', 'Till filistéerna? Till jättarna? Jag har en fråga: äter de lamm?'],
      ['abiszaj', 'Inte alla, lamm. Men håll dig nära morbror.'],
    ],
    itaj: [
      ['itaj', 'Välkommen till Gat! Jag är Ittai. Alla här är inte jättar. Jag till exempel är en vän.'],
      ['itaj', 'Men var försiktig. Kung Akis tjänare minns sången om tiotusen.'],
      ['klebek', 'Den sången hinner före oss överallt. Den är snabbare än Asael.'],
      ['dawid', 'Tack, Ittai. Jag ska vara försiktig.'],
    ],
    achisz: [
      ['narrator', 'Tjänarna för David inför kung Akis. David är rädd, så han låtsas vara galen.'],
      ['achisz', 'Är det här den store David? Han från sången?'],
      ['klebek', 'Spela galen. Jag spelar det förvånade lammet. Det är det jag kan bäst.'],
    ],
    ziklag: [
      ['narrator', 'Åren går. David kommer tillbaka till Gat med sexhundra man, och Akis ger honom den lilla staden Siklag.'],
      ['narrator', 'En dag, efter tre dagars vandring, kommer David hem. Siklag är nedbränt och tomt.'],
      ['abiszaj', 'Rövare från öknen tog kvinnorna, barnen och allt de ägde. Ingen kom till skada, men alla är borta.'],
      ['narrator', 'Männen gråter tills de inte orkar mer. Några ser på David med vrede.'],
      ['narrator', 'David är ensam en stund, i tystnaden, med Gud. Sedan reser han sig.'],
      ['dawid', 'Res er. Vi går efter dem. Vi tar tillbaka allt.'],
    ],
    flock: [
      ['narrator', 'Vargarna flyr ut i öknen. Fåren och getterna från Siklag står samlade, hela och friska.'],
      ['klebek', 'Får! Riktiga får! Efter alla dessa länder känner jag mig som hemma.'],
      ['abiszaj', 'Hjordarna är tillbaka. Nu familjerna.'],
    ],
    families: [
      ['narrator', 'Rövarna flyr på kameler och lämnar kvar allt de tog.'],
      ['narrator', 'Familjerna kommer tillbaka till Siklag. Ingen saknas, från den yngsta till den äldsta.'],
      ['abigail', 'Alla är här. Alla! Till och med grannfruns get.'],
      ['dawid', 'De vid Besors bäck vaktade packningen. De får lika mycket som vi. Vi delar lika.'],
      ['klebek', 'Lika! Så jag får också ost. Äntligen har rättvisan nått öknen.'],
    ],
    szamma: [
      ['szamma', 'Stopp! Det här är ett linsfält. Jag ger inte upp det. Inte för vargar, inte för jättar. Inte för någon.'],
      ['dawid', 'Ingen vill ta det från dig, Samma. Vi vill hjälpa till.'],
      ['szamma', 'Hjälpa? Att försvara linser? …Det ändrar saken. Jag följer med er.'],
      ['klebek', 'Linser! Jag sa ju att de skulle komma till nytta. Sa jag inte? Då säger jag det nu.'],
    ],
    end: [
      ['narrator', 'Jätten från Gat faller raklång, och hans läger skingras över kullarna.'],
      ['narrator', 'Eldarna brinner i Siklag igen. Av bytet skickar David gåvor till de äldste i Juda, sina grannar.'],
      ['itaj', 'Jag är filisté, men jag går med dig. Vad som än kommer.'],
      ['narrator', 'Snart ska Juda män i Hebron smörja David till kung. Men det är en annan historia.'],
      ['klebek', 'Minns du fårfållan? Schakaler, törne, lejonet. Där började hela vägen.'],
      ['klebek', 'Nu går vi en gång till, från betesmarkerna. Du med slungan, jag med råden. Bli bara inte uppäten.'],
    ],
  },
  choices: {
    achisz: {
      a: 'Klottra på porten',
      b: 'Sjung en fånig visa',
      ra: [
        ['narrator', 'David river i portens dörrar och låter saliven rinna ner i skägget. Vakterna backar ett steg.'],
        ['achisz', 'Har jag för få galningar i Gat? För bort honom!'],
      ],
      rb: [
        ['dawid', 'Bää, mää, en jätte i hatt, bää!'],
        ['achisz', 'Har jag för få galningar i Gat? För bort honom!'],
      ],
    },
  },
};
