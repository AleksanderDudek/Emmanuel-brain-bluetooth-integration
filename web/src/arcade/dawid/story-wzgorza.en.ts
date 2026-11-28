/**
 * Dawid's story words: the hills of Judah, English (from the Polish source, story-wzgorza.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'The stony hills of Judah, vineyards on the slopes and a road to the north. King Saul cannot sleep at night, and his servants seek someone to play the harp for him.',
  areas: {
    winnice: { name: 'The hillside vineyards', line: 'Terraces of vines, low stone walls and fresh hoof marks. Something dug here last night.' },
    trakt: { name: 'The king’s road', line: 'The road over the hills to the north, to the king. Dust, stones and vipers in the ditches.' },
    przelecz: { name: 'The pass by Saul’s camp', line: 'The king’s tents on one side, the she-bear’s den on the other. Let’s go quietly.' },
  },
  quests: {
    sluga: 'Talk to the king’s servant',
    vines: 'Defend the vineyard from the boars',
    abiszaj: 'Find Abishai by the road',
    donkey: 'Lead the donkey with gifts to the king',
    harp: 'Play the harp for the king',
  },
  things: {
    donkey: 'donkey with gifts',
  },
  scenes: {
    open: [
      ['narrator', 'The stony hills of Judah. Grapes ripen on the terraces, and vipers sleep in the grass.'],
      ['kobieta', 'Boars are digging up my vineyard! One more night and there’ll be nothing left but sticks.'],
      ['klebek', 'Boars? Big ones? With tusks? I’m only asking out of curiosity. Scientific curiosity.'],
      ['narrator', 'And on the king’s road someone from the court is asking about Jesse’s son.'],
    ],
    sluga: [
      ['sluga', 'I’m looking for Jesse’s son. Is that you? They say you play the harp and aren’t afraid of lions.'],
      ['klebek', 'True. The lion is afraid of him. I’m the proof.'],
      ['sluga', 'King Saul cannot sleep at night. A heavy unrest sits on his heart. He needs music.'],
      ['dawid', 'I’ll play for him. My father will send gifts for the king with me.'],
      ['sluga', 'Good. The king waits in the camp by the pass. Just watch out for boars on the way.'],
    ],
    vines: [
      ['narrator', 'The last boar bolts into the bushes, and the whole boar family after it, from biggest to smallest.'],
      ['kobieta', 'My vineyard is saved! Take a basket of grapes for the road. The lamb may try some too.'],
      ['klebek', 'One grape first. To check. Then the rest, to be sure.'],
    ],
    abiszaj: [
      ['abiszaj', 'Uncle! Asahel says you’re going to the king. Alone? With a lamb? Without a shield?'],
      ['dawid', 'With a harp, Abishai. You don’t take a shield to a concert.'],
      ['abiszaj', 'I always do. Someone has to look after Uncle. I’m coming with you.'],
      ['klebek', 'A shield bigger than him. Good. If anything happens, I’ll hide behind it.'],
    ],
    donkey: [
      ['narrator', 'Jesse’s donkey carries bread and a kid for the king. It walks slowly and stops at every thistle.'],
      ['klebek', 'Get moving, donkey! The king is waiting! …Don’t look at me like that. I’m an animal too.'],
      ['narrator', 'At the stone by the crossroads the king’s men are waiting. They take the gifts and lead David on to the pass.'],
    ],
    harp: [
      ['narrator', 'It is dark in the king’s tent. Saul sits with his head in his hands; he has not slept for many nights.'],
      ['saul', 'Play. Perhaps with you here I can breathe again.'],
      ['narrator', 'David touches the strings. The tune flows softly like a brook at night, and the king’s shoulders slowly ease.'],
      ['saul', 'Stay with me. From now on you carry my armour.'],
      ['klebek', 'The king’s armour-bearer! And me? The armour-bearer’s armour-bearer? I can carry… cheese.'],
    ],
    end: [
      ['narrator', 'The she-bear gathers her cubs and goes off deep into the woods. The pass is open.'],
      ['narrator', 'News comes over the hills: the Philistines have camped in the Valley of Elah, facing Saul’s army.'],
      ['jesse', 'Your three brothers are with the army. Take them bread and cheeses and bring me word of how they are.'],
      ['klebek', 'Cheeses! I’ll carry them. As far as the first bend. Then we’ll see.'],
    ],
  },
  choices: {
    harp: {
      a: 'Play the shepherds’ song',
      b: 'Play a quiet tune',
      ra: [
        ['saul', 'The shepherds’ song… Once I searched these hills for my father’s donkeys.'],
        ['narrator', 'The king smiles for the first time in many weeks.'],
      ],
      rb: [
        ['narrator', 'The strings barely whisper. It grows so still you can hear the king breathe. Saul falls asleep.'],
        ['klebek', 'Shh. I’m asleep too. Nearly.'],
      ],
    },
  },
};
