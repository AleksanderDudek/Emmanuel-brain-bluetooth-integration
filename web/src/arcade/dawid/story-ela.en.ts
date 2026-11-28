/**
 * Dawid's story words: the Valley of Elah, English (from the Polish source, story-ela.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'The Valley of Elah. Israel’s camp on one side, the Philistines on the other, and in the middle a giant from Gath who has defied the whole army for forty days.',
  areas: {
    oboz: { name: 'Israel’s camp', line: 'Tents on the slope, baggage carts and campfires. The soldiers look like sheep in a storm.' },
    terebint: { name: 'The terebinth valley', line: 'An old terebinth and a brook in the valley. The smoothest stones in all Judah lie here.' },
    pole: { name: 'The field between the armies', line: 'The Philistines stand on the far slope, and in front of them someone very, very big.' },
  },
  quests: {
    bread: 'Take Eliab the bread and cheeses',
    soldiers: 'Talk to the soldiers',
    saul: 'Go to King Saul’s tent',
    stones: 'Choose smooth stones from the brook',
    goliath: 'Go out to meet the giant',
    jonatan: 'Jonathan is waiting for you',
  },
  things: {
    bread: 'bread and cheeses',
    stone: 'smooth stone',
  },
  scenes: {
    open: [
      ['narrator', 'The Valley of Elah. Israel’s tents on one slope, the Philistines on the other, and a brook in between.'],
      ['narrator', 'Morning and evening the giant from Gath walks out of the Philistine camp and shouts across the valley.'],
      ['goliat', 'Give me one man! Just one! Forty days I’ve waited, and nothing.'],
      ['klebek', 'Baaa… That’s a man? His spear is like a weaver’s beam. And I have a cheese.'],
    ],
    bread: [
      ['eliab', 'And what are you doing here? Who’s minding the sheep? Come to watch the battle, have you?'],
      ['dawid', 'I’m only asking. Father sent bread and cheeses.'],
      ['eliab', 'Cheeses? …Hand them over. But you still annoy me.'],
      ['klebek', 'Eliab ate three cheeses. I ate the crumbs. Fairness is a rare guest in this valley.'],
    ],
    soldiers: [
      ['zolnierz', 'See him? That’s Goliath of Gath. As tall as two men, and his armour weighs as much as a donkey.'],
      ['zolnierz', 'The king has promised: whoever beats him gets riches and the king’s daughter, and his family pays no taxes.'],
      ['klebek', 'No taxes! Jesse will be pleased. Maybe even more than with the king’s daughter.'],
    ],
    saul: [
      ['saul', 'So young, and he has fought since his youth. How do you mean to stand against him?'],
      ['dawid', 'I keep sheep, my king. The lion and the she-bear thought I was small too.'],
      ['saul', 'Go, then. But at least take my armour and my helmet.'],
    ],
    stones: [
      ['narrator', 'David puts five smooth stones from the brook into his shepherd’s bag. Only five.'],
      ['klebek', 'Why five? Spares? In case the giant has brothers?'],
      ['dawid', 'One is enough. Count the rest, so you feel better.'],
    ],
    goliath: [
      ['goliat', 'You come at me with a stick? What am I, a dog? They’ve sent me a shepherd boy with pebbles!'],
      ['klebek', 'Baaa… he’s talking to us. Don’t answer. Or answer from far away.'],
      ['dawid', 'You have a sword, a spear and a shield-bearer. And I do not come alone.'],
      ['narrator', 'A shield-bearer with a great shield walks before the giant. Stones bounce off it with a clang.'],
      ['klebek', 'Go round his side! Or throw the great stone: it flies over the shield.'],
    ],
    jonatan: [
      ['narrator', 'After the battle David stands before the king, sling in hand. Beside the king stands his son, Jonathan.'],
      ['jonatan', 'Nobody has ever shut a giant’s mouth like that. From today we are brothers.'],
      ['narrator', 'Jonathan takes off his cloak, belt and bow and gives them to David. They make a covenant of friendship.'],
      ['klebek', 'A prince’s cloak! So soft. Can I be in the covenant too? Just a little?'],
      ['jonatan', 'You too, lamb. You most of all.'],
    ],
    end: [
      ['narrator', 'The stone from the sling strikes the giant on the forehead. Goliath falls full length, face down in the grass.'],
      ['narrator', 'The Philistines flee the valley, and Israel’s army goes home singing.'],
      ['eliab', 'All right then… Today I’ll mind the sheep.'],
      ['klebek', 'One stone. One! I’m telling everyone: one.'],
      ['narrator', 'Saul will not let David go back to his father any more. He takes him with him to Gibeah.'],
    ],
  },
  choices: {
    soldiers: {
      a: 'Who is he, to shout like that?',
      b: 'And what does the lamb get?',
      ra: [
        ['zolnierz', 'Who? A giant. For a giant, that’s reason enough to shout.'],
        ['dawid', 'He shouts at God’s people. He won’t be shouting much longer.'],
      ],
      rb: [
        ['zolnierz', 'The lamb? Hm… A bowl of lentils, probably.'],
        ['klebek', 'Lentils! Deal. Let’s go and see the giant.'],
      ],
    },
    saul: {
      a: 'Try on the king’s armour',
      b: 'Thank him, keep the sling',
      ra: [
        ['narrator', 'David takes two steps, clanks like a pot and takes it all off. You can’t walk in this.'],
        ['klebek', 'That sounded like a kitchen before a feast. Better go in your tunic.'],
      ],
      rb: [
        ['dawid', 'Thank you, my king. But I go in a tunic, with my staff and my sling.'],
        ['saul', 'As you wish. Only come back in one piece.'],
      ],
    },
  },
};
