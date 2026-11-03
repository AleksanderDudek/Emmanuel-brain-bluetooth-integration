/**
 * The exercise cards' palette and shapes (src/cards/DESIGN.md §3): the flat colours of the
 * "Wersja 4K" cards, sampled from their PNGs, so the games, the pad and the printed cards
 * speak one visual language.  Colours are referred to by id everywhere (saved trials keep ids,
 * not hex values or words), and each has a small mark for players who tell colours apart badly.
 */

export const COLORS = {
  navy: '#0C3992',
  purple: '#7B61FF',
  coral: '#FE6F61',
  teal: '#00CFC1',
  yellow: '#FFD25A',
  peach: '#FFB38A',
  magenta: '#C2379B',
  violet: '#4E0C93',
  /** card 32's green block (only there) */
  green: '#4E8B4A',
  grey: '#9CA3AF',
  ink: '#111827',
} as const;

export type ColorId = keyof typeof COLORS;
export const COLOR_IDS = Object.keys(COLORS) as ColorId[];

/** Text that stays readable on each colour (the light ones take ink, the dark ones white). */
export const ON_COLOR: Readonly<Record<ColorId, string>> = {
  navy: '#fff', purple: '#fff', coral: '#fff', teal: '#073b39', yellow: '#3b2a00', peach: '#4a2410',
  magenta: '#fff', violet: '#fff', green: '#fff', grey: '#111827', ink: '#fff',
};

/**
 * The colour marks (lobby option "Oznaczenia kolorów"): a tiny symbol inside every coloured item,
 * on the board and on the pad alike, so a player with a colour-vision deficiency plays the same
 * rule by symbol.  The symbols are not the game shapes, so they never answer a shape question.
 */
export const COLOR_MARK: Readonly<Record<ColorId, string>> = {
  navy: '●', purple: '◆', coral: '▲', teal: '■', yellow: '✚', peach: '◐', magenta: '✱', violet: '◇', green: '♣', grey: '○', ink: '✕',
};

/** The shapes of cards 12, 16, 23 and 31, drawn in a 100×100 box. */
export type ShapeId = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'hexagon' | 'pill' | 'twoDots' | 'hand';
/** The six shapes of the shape games (cards 23, 31); cards 25 and 30 add a pill, two dots and a hand. */
export const SHAPE_IDS: readonly ShapeId[] = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'];
export const ALL_SHAPE_IDS: readonly ShapeId[] = [...SHAPE_IDS, 'pill', 'twoDots', 'hand'];

const star = (): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 19 : 44, a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(53 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

const hexagon = (): string => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push(`${(50 + 43 * Math.cos(a)).toFixed(1)} ${(50 + 43 * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

/** SVG path data of each shape (viewBox 0 0 100 100). */
export const SHAPE_PATH: Readonly<Record<ShapeId, string>> = {
  circle: 'M50 8a42 42 0 1 1 0 84a42 42 0 1 1 0-84Z',
  square: 'M14 14h72v72h-72Z',
  triangle: 'M50 9L92 86H8Z',
  star: star(),
  heart: 'M50 88C20 66 8 50 8 33C8 19 19 9 32 9c8 0 14 4 18 10c4-6 10-10 18-10c13 0 24 10 24 24c0 17-12 33-42 55Z',
  hexagon: hexagon(),
  pill: 'M22 35h56a15 15 0 0 1 0 30h-56a15 15 0 0 1 0-30Z',
  twoDots: 'M29 36a14 14 0 1 1 0 28a14 14 0 1 1 0-28ZM71 36a14 14 0 1 1 0 28a14 14 0 1 1 0-28Z',
  // a flat hand, fingers up: the palm, four fingers and the thumb (card 30's big hand)
  hand: 'M29 52h44v24a16 16 0 0 1-16 16h-12a16 16 0 0 1-16-16ZM29 56V30a5.5 5.5 0 0 1 11 0V56ZM41 54V20a5.5 5.5 0 0 1 11 0V54Z'
    + 'M53 54V23a5.5 5.5 0 0 1 11 0V54ZM65 56V33a5 5 0 0 1 10 0V58ZM30 70L15 55a5.5 5.5 0 0 1 8-7.5L36 60Z',
};
