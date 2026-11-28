/**
 * Dawid's story words: the fields of Gibeah, English (from the Polish source, story-gibea.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'Gibeah, King Saul’s town. The women sing of David louder than of the king, and the king watches it all more and more darkly. Only Jonathan stands by his friend.',
  areas: {
    pola: { name: 'The barley fields', line: 'Waist-high barley, field paths and tracks. Young aurochs think barley is delicious too.' },
    mury: { name: 'The walls of Gibeah', line: 'The walls of the king’s town and, in the wall, Michal’s window. High up. Very high up.' },
    ezel: { name: 'The stone Ezel', line: 'A great stone in the middle of the field. A good place to hide. And to wait.' },
  },
  quests: {
    women: 'Listen to the women’s song',
    rope: 'Find a strong rope',
    mikal: 'Go under Michal’s window',
    barley: 'Defend the widow’s barley from the boars',
    ezel: 'Meet Jonathan by the stone Ezel',
    arrows: 'Bring back Jonathan’s arrows',
    farewell: 'Say goodbye to Jonathan',
  },
  things: {
    rope: 'strong rope',
    arrow: 'arrow of Jonathan’s',
  },
  scenes: {
    open: [
      ['narrator', 'Gibeah, King Saul’s town. David lives at court now and goes out with the army on campaigns.'],
      ['jonatan', 'Wherever my father sends you, you succeed. The people love you. So do I.'],
      ['narrator', 'But the king looks at David more and more darkly, and more and more often he grips his spear.'],
      ['klebek', 'I don’t like that spear. It’s too close and too often.'],
    ],
    women: [
      ['narrator', 'Women come out of the towns with tambourines and dance to welcome the army.'],
      ['narrator', 'They sing that Saul has his thousands and David his tens of thousands. The king listens and darkens.'],
      ['saul', 'Tens of thousands for him, thousands for me. All he lacks now is the kingdom.'],
      ['narrator', 'The next day, as David plays, the king hurls his spear. It sticks in the wall. David dodges.'],
      ['klebek', 'Baaa! That wasn’t a note! That was a spear!'],
    ],
    rope: [
      ['narrator', 'Under the wall, in a pile of hay, lies a long, strong rope. Just the kind that’s needed.'],
      ['mikal', 'David, my father’s men are at the door. If you don’t get away tonight, in the morning it will be too late.'],
      ['klebek', 'A rope, a wall, a window and the night. I have a bad feeling. And a fear of heights.'],
    ],
    mikal: [
      ['narrator', 'Michal, the king’s daughter and David’s wife, ties the rope in the window on the wall side.'],
      ['mikal', 'I’ll put a dummy in the bed with a goat-hair pillow. I’ll say you have a fever.'],
      ['klebek', 'A dummy of goat hair? It will look more like me than like you.'],
    ],
    barley: [
      ['narrator', 'The boars run off the field, squealing farewell.'],
      ['kobieta', 'My barley! All of it! I have no husband and no son, only this field. Thank you.'],
      ['klebek', 'Field saved, widow happy, boars offended. Just how I like it.'],
    ],
    ezel: [
      ['jonatan', 'Tomorrow is the new moon and my father’s feast. Your seat at the table will be empty. I’ll see what he says.'],
      ['jonatan', 'Hide by this stone. I’ll shoot three arrows and send a boy to fetch them.'],
      ['jonatan', 'If I call, “The arrows are this side,” come back in peace. If I call, “Further,” run.'],
      ['klebek', 'A simple plan. I like simple plans. As long as nobody aims at lambs.'],
    ],
    arrows: [
      ['chlopiec', 'Three arrows! Thank you. I’d have been looking for them till evening.'],
      ['jonatan', 'The last one flew further… Much further than I wanted.'],
      ['narrator', 'David understands the sign. Further means: run. The king wants him gone for good.'],
      ['klebek', 'I don’t like the word “further”. It’s sad. And far.'],
    ],
    farewell: [
      ['narrator', 'The boy goes back to town with the arrows. David comes out from behind the stone.'],
      ['narrator', 'The friends embrace and weep. David weeps the more.'],
      ['jonatan', 'Go in peace. Whatever happens, we will stay friends: we and our children.'],
      ['dawid', 'I will never forget this, Jonathan. Never.'],
      ['klebek', 'I’m not crying. It’s dust. Field dust.'],
    ],
    end: [
      ['narrator', 'The great aurochs snorts and thunders off across the steppe. The road south, to the wilderness, lies open.'],
      ['klebek', 'The road is open. But before we go… Jonathan is waiting by the stone.'],
      ['narrator', 'David knows what the last arrow meant. He goes to say goodbye.'],
    ],
  },
  choices: {
    mikal: {
      a: 'Climb down the rope',
      b: 'The lamb first, in a basket',
      ra: [
        ['narrator', 'David slides down the rope and vanishes into the dark. Michal waves from the window.'],
      ],
      rb: [
        ['klebek', 'In a basket? Me? …All right. But slowly. And I’m not looking down.'],
        ['narrator', 'The basket with the lamb goes down first, then David. Nobody hears a thing.'],
      ],
    },
  },
};
