/**
 * Dawid's story words: the wilderness of En-Gedi, English (from the Polish source, story-engedi.ts: the same ids,
 * speakers and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'Saul hunts for David all over the wilderness with three thousand chosen men. David and his four hundred hide among the rocks of En-Gedi, where a spring flows and ibexes leap.',
  areas: {
    skaly: { name: 'The Rocks of the Wild Goats', line: 'Steps of rock, ibexes on the ledges and caracals in the cracks. Watch your step.' },
    jaskinia: { name: 'The cave by the sheepfolds', line: 'Stone sheepfolds by the road and behind them a cave’s dark mouth. Cool and quiet inside.' },
    zrodlo: { name: 'The spring of En-Gedi', line: 'Water falls from a high rock among palms and reeds. The loveliest place in the wilderness.' },
  },
  quests: {
    achimelek: 'Go to Ahimelech the priest at Nob',
    benajasz: 'Find Benaiah',
    cave: 'Hide in the cave',
    call: 'Call after the king from the hill',
    water: 'Fill the water skins in the cave',
    abigail: 'Go out to meet Abigail',
    kid: 'Save the kid from the caracals',
  },
  things: {
    water: 'water skin',
    kid: 'kid goat',
    corner: 'corner of the robe',
  },
  scenes: {
    open: [
      ['narrator', 'In the cave of Adullam David’s brothers gather to him, and then the troubled, the indebted and the bitter.'],
      ['klebek', 'Four hundred new friends! I do hope none of them likes lamb.'],
      ['narrator', 'With them David goes into the wilderness of En-Gedi, by the Salt Sea. King Saul searches for him everywhere.'],
      ['abiszaj', 'Uncle, four hundred men and one spring. We need water, bread and a little peace.'],
      ['klebek', 'And cheese. Four hundred cheeses. All right, three hundred. I hardly eat anything.'],
    ],
    achimelek: [
      ['narrator', 'Hungry and unarmed, David comes to Nob, the priests’ town. His men wait in hiding.'],
      ['achimelek', 'Alone? Without your men? What has happened?'],
      ['dawid', 'Urgent business, priest. Do you have some bread for the road?'],
      ['achimelek', 'Only the bread of the Presence, taken off the table today. Take it, and the giant’s sword in its cloak.'],
      ['klebek', 'Goliath’s sword? Twice as long as me. And heavier than both of us.'],
    ],
    benajasz: [
      ['benajasz', 'I’m Benaiah. I hear you are gathering men who aren’t afraid.'],
      ['klebek', 'You’re not afraid? Of anything? Not even a lion?'],
      ['benajasz', 'Once, on a snowy day, I went down into a pit where a lion was. And I came out alone.'],
      ['klebek', 'Once I was in a lion’s mouth. I came out too. With help. We have something in common.'],
    ],
    cave: [
      ['narrator', 'Saul and his army halt by the sheepfolds. He goes into the cave alone, not knowing who sits in its depths.'],
      ['abiszaj', 'Uncle, it’s him! Alone, without guards. A moment like this won’t come again.'],
      ['dawid', 'I will not raise my hand against the king. It is not for me to judge him.'],
      ['klebek', 'Shh. He’s resting. We breathe quietly. Very quietly.'],
    ],
    call: [
      ['narrator', 'Saul leaves the cave and goes on his way. David runs up the hill after him and calls out.'],
      ['dawid', 'My lord the king! I was right beside you in the cave, and I did not raise my hand against you.'],
      ['saul', 'David? Is that you? …My son, there is more good in your heart than in mine.'],
      ['narrator', 'Saul weeps. Then he turns for home with his army.'],
      ['klebek', 'The king weeps, I weep, even the ibexes have wet eyes. A good day.'],
    ],
    water: [
      ['narrator', 'Water drips from the cave’s roof, drop by drop. Three water skins full.'],
      ['abiszaj', 'Drop by drop, and the men have something to drink. Good work, Uncle.'],
      ['klebek', 'I only had one sip. A big one. A very big one. But one.'],
    ],
    abigail: [
      ['narrator', 'Rich Nabal of Carmel sent David’s men away empty-handed, though they guarded his flocks. David is furious.'],
      ['narrator', 'But down the road on a donkey comes Abigail, Nabal’s wife, with bread, raisins and fig cakes.'],
      ['abigail', 'My lord, pay no heed to Nabal. His name means “fool”, and that is what he is.'],
      ['abigail', 'Do not take on yourself a wrong you would regret later. Accept these gifts.'],
      ['dawid', 'Thank you for your wisdom. You are keeping me from a bad step.'],
      ['klebek', 'Fig cakes! She knows how to talk to a team.'],
    ],
    kid: [
      ['narrator', 'The caracals flee into the cracks. On a rock ledge a little kid is trembling.'],
      ['klebek', 'It’s all right, little one. I was in trouble once too. Now I go about with David and all is well.'],
      ['narrator', 'The kid leaps to its mother. The ibex looks at David a long while, then both vanish into the rocks.'],
    ],
    end: [
      ['narrator', 'The leopard leaps onto the rock and vanishes over the ridge. The path west, to the land of Gath, is open.'],
      ['dawid', 'Saul will not stop looking for me. I’ll go where he isn’t looking: to the Philistines.'],
      ['abigail', 'We’ll come with you. There are supplies enough for the road.'],
      ['klebek', 'To Gath? Where the giants live? Fine. But I walk right in the middle of the team.'],
    ],
  },
  choices: {
    cave: {
      a: 'Cut off a corner of his robe',
      b: 'Slip back into the cave',
      ra: [
        ['narrator', 'David cuts off a corner of the king’s robe. Saul feels nothing.'],
        ['klebek', 'A corner of a robe. The most precious patch in all Israel.'],
      ],
      rb: [
        ['narrator', 'David steps back into the dark. Saul gets up, straightens his robe and walks out, knowing nothing.'],
        ['klebek', 'Nobody knows how close it was. Only us. And that is enough.'],
      ],
    },
  },
};
