/**
 * Dawid's story words: the pastures of Bethlehem, English (from the Polish source, story-pastwiska.ts: the same
 * ids, speakers and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'The youngest of Jesse’s eight sons keeps his father’s sheep on the hills of Bethlehem. The prophet Samuel is on his way to town, and in the thicket past the brook the lion lurks again.',
  areas: {
    owczarnia: { name: 'Jesse’s sheepfold', line: 'A stone wall, a thorny hedge and a hundred sheep who are counting on you.' },
    studnia: { name: 'The well by the gate', line: 'The well of Bethlehem: the coldest water in all Judah. An old shepherd dozes by the gate.' },
    potok: { name: 'The brook of smooth stones', line: 'A brook full of round stones. Beyond it a thicket, and in the thicket something roars.' },
  },
  quests: {
    lamb: 'Find the lamb lost in the thorns',
    well: 'Talk to the girl at the well',
    jar: 'Take a jar of water to the old shepherd',
    asahel: 'Find Asahel on the hill',
    ewe: 'Save a ewe and her lamb from the wolves',
  },
  things: {
    lamb: 'lost lamb',
    jar: 'jar of water',
  },
  scenes: {
    open: [
      ['narrator', 'The prophet Samuel comes to Jesse’s house. Seven sons stand before him.'],
      ['samuel', 'He is not the one either. Have you another son, Jesse?'],
      ['jesse', 'There’s the youngest, David. He keeps the sheep. He always smells of sheep.'],
      ['narrator', 'David runs in from the pasture. Samuel anoints him with oil among his brothers.'],
      ['eliab', 'Him? The sheep boy? But I’m the tallest!'],
      ['klebek', 'Now he smells of oil. And sheep. But mostly oil.'],
    ],
    lamb: [
      ['klebek', 'Hear that bleating? That’s not me. I bleat more nicely.'],
      ['narrator', 'A little lamb sits in the thorns, tangled up to its ears. David frees it gently.'],
      ['klebek', 'Welcome to the flock, little one. Rule one: we don’t walk into thorns. Rule two: we stay close to David.'],
    ],
    well: [
      ['dziewczyna', 'Was the prophet at your house? All Bethlehem is talking about it.'],
      ['dawid', 'He was. He had supper with us and went. And I went back to the sheep.'],
      ['dziewczyna', 'The jar is heavy and home is far. They say you play the harp too?'],
      ['klebek', 'He plays. And he carries. Just not at the same time.'],
    ],
    jar: [
      ['starzec', 'Water from the well by the gate… My grandfather drank it, and his grandfather. Thank you with all my heart.'],
      ['starzec', 'I saw wolves by the brook last night. Watch the sheep: they go for the youngest.'],
      ['klebek', 'The youngest? I’m the youngest! Well, nearly. Let’s watch the sheep.'],
    ],
    asahel: [
      ['asahel', 'Uncle! I heard the prophet came to Grandfather’s. Now we really are racing to the lion!'],
      ['dawid', 'We don’t race to the lion, Asahel. We go to the lion carefully.'],
      ['asahel', 'Carefully, but fast! I run faster than a gazelle. You’ll see.'],
      ['klebek', 'One runs like a gazelle, one throws like a storm. And me? I give moral support.'],
    ],
    ewe: [
      ['narrator', 'The wolves flee into the bushes. A ewe and her lamb huddle against David’s legs.'],
      ['klebek', 'It’s all right, mum. This is David. He always does this: comes, throws, wolves vanish.'],
      ['jesse', 'You keep the flock well, David. But there’s roaring from the thicket. The lion is close.'],
    ],
    end: [
      ['narrator', 'The lion takes a stone on the nose and flees into the hills. The sheep come back to the pasture one by one.'],
      ['jesse', 'Every sheep safe. And Tuft?'],
      ['klebek', 'Safe too. Thanks for asking. A bit late, but still.'],
      ['narrator', 'That evening word comes: King Saul cannot sleep, and his servants are looking for someone who plays the harp.'],
      ['klebek', 'You play the harp! I sing. More or less. Off to the hills?'],
    ],
  },
  choices: {
    well: {
      a: 'Carry her jar home',
      b: 'Play her a tune on the harp',
      ra: [
        ['dziewczyna', 'Thank you! Mother will give you a silver piece. Or two, if the lamb doesn’t eat her bread.'],
        ['klebek', 'No promises.'],
      ],
      rb: [
        ['narrator', 'The well goes quiet. Even the donkeys stop braying.'],
        ['dziewczyna', 'Lovely… Now the jar carries itself.'],
      ],
    },
  },
};
