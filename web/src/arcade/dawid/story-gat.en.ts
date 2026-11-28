/**
 * Dawid's story words: the land of Gath, English (from the Polish source, story-gat.ts: the same ids, speakers
 * and number of lines).
 */
import type { LandWords } from './story';

export const EN: LandWords = {
  chapter: 'The land of Gath, the home of the giants. Here, among the Philistines, David seeks shelter from Saul. Not every Philistine is a foe, and one will become a friend.',
  areas: {
    brama: { name: 'The gate of Gath', line: 'The city’s tall gates and guards in plumed caps. Beyond the gate lives King Achish.' },
    ziklag: { name: 'Ziklag', line: 'A little town on the desert’s edge: low walls, a well and homes for six hundred families.' },
    obozowisko: { name: 'The giants’ camp', line: 'Tents as big as barns and a rack of spears as thick as beams. Someone here is very big.' },
  },
  quests: {
    itaj: 'Meet Ittai of Gath',
    achisz: 'Stand before King Achish',
    ziklag: 'Go back to Ziklag',
    flock: 'Save the flocks from the wolves',
    families: 'Bring the families home',
    szamma: 'Shammah defends the lentil field',
  },
  things: {
    flock: 'flock of Ziklag',
    families: 'families of Ziklag',
  },
  scenes: {
    open: [
      ['narrator', 'The land of Gath, the home of the giants. David comes here to hide from Saul.'],
      ['klebek', 'To the Philistines? To the giants? I have a question: do they eat lambs?'],
      ['abiszaj', 'Not all of them, lamb. But stay close to Uncle.'],
    ],
    itaj: [
      ['itaj', 'Welcome to Gath! I’m Ittai. Not everyone here is a giant. Me, for example: I’m a friend.'],
      ['itaj', 'But be careful. King Achish’s servants remember the song about tens of thousands.'],
      ['klebek', 'That song gets everywhere before us. It’s faster than Asahel.'],
      ['dawid', 'Thank you, Ittai. I’ll be careful.'],
    ],
    achisz: [
      ['narrator', 'The servants bring David before King Achish. David is afraid, so he pretends to be mad.'],
      ['achisz', 'This is the great David? The one from the song?'],
      ['klebek', 'Play the madman. I’ll play the puzzled lamb. That’s what I do best.'],
    ],
    ziklag: [
      ['narrator', 'Years pass. David comes back to Gath with six hundred men, and Achish gives him the little town of Ziklag.'],
      ['narrator', 'One day, after three days on the road, David comes home. Ziklag is burnt and empty.'],
      ['abiszaj', 'Desert raiders took the women, the children and everything. Nobody was harmed, but everyone is gone.'],
      ['narrator', 'The men weep until they have no strength left. Some look at David in anger.'],
      ['narrator', 'David stays alone a while, in silence, with God. Then he gets up.'],
      ['dawid', 'Stand up. We will go after them. We will bring everything back.'],
    ],
    flock: [
      ['narrator', 'The wolves flee into the wilderness. The sheep and goats of Ziklag stand together, safe and sound.'],
      ['klebek', 'Sheep! Real sheep! After all these lands I feel right at home.'],
      ['abiszaj', 'The flocks are back. Now the families.'],
    ],
    families: [
      ['narrator', 'The raiders flee on camels and leave behind everything they took.'],
      ['narrator', 'The families come back to Ziklag. Nobody is missing, from the youngest to the oldest.'],
      ['abigail', 'Everyone’s here. Everyone! Even the neighbour’s goat.'],
      ['dawid', 'Those by the brook Besor guarded the baggage. They get the same as us. We share alike.'],
      ['klebek', 'Alike! So I get cheese too. At last fairness has reached the wilderness.'],
    ],
    szamma: [
      ['szamma', 'Stop! This is a lentil field. I won’t give it up. Not to wolves, not to giants. Not to anyone.'],
      ['dawid', 'Nobody wants to take it from you, Shammah. We want to help.'],
      ['szamma', 'Help? Defend lentils? …Well, that changes everything. I’m coming with you.'],
      ['klebek', 'Lentils! I said they’d come in handy one day. Didn’t I? Well, I’m saying it now.'],
    ],
    end: [
      ['narrator', 'The giant of Gath falls full length, and his camp scatters over the hills.'],
      ['narrator', 'Fires burn in Ziklag again. From the spoil David sends gifts to the elders of Judah, his neighbours.'],
      ['itaj', 'I am a Philistine, but I go with you. Come what may.'],
      ['narrator', 'Soon, in Hebron, the men of Judah will anoint David king. But that is another story.'],
      ['klebek', 'Remember the sheepfold? Jackals, thorns, the lion. That’s where the whole road began.'],
      ['klebek', 'Now we go once more, from the pastures. You with the sling, me with advice. Just don’t get eaten.'],
    ],
  },
  choices: {
    achisz: {
      a: 'Scribble on the gate',
      b: 'Sing a silly song',
      ra: [
        ['narrator', 'David scratches at the doors of the gate and dribbles down his beard. The guards step back.'],
        ['achisz', 'Am I short of madmen in Gath? Take him away!'],
      ],
      rb: [
        ['dawid', 'Baaa, meee, a giant in a hat, baaa!'],
        ['achisz', 'Am I short of madmen in Gath? Take him away!'],
      ],
    },
  },
};
