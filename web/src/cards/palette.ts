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
  grey: '#9CA3AF',
  ink: '#111827',
} as const;

export type ColorId = keyof typeof COLORS;
export const COLOR_IDS = Object.keys(COLORS) as ColorId[];

/** Text that stays readable on each colour (the light ones take ink, the dark ones white). */
export const ON_COLOR: Readonly<Record<ColorId, string>> = {
  navy: '#fff', purple: '#fff', coral: '#fff', teal: '#073b39', yellow: '#3b2a00', peach: '#4a2410',
  magenta: '#fff', violet: '#fff', grey: '#111827', ink: '#fff',
};

/**
 * The colour marks (lobby option "Oznaczenia kolorów"): a tiny symbol inside every coloured item,
 * on the board and on the pad alike, so a player with a colour-vision deficiency plays the same
 * rule by symbol.  The symbols are not the game shapes, so they never answer a shape question.
 */
export const COLOR_MARK: Readonly<Record<ColorId, string>> = {
  navy: '●', purple: '◆', coral: '▲', teal: '■', yellow: '✚', peach: '◐', magenta: '✱', violet: '◇', grey: '○', ink: '✕',
};

/** The shapes of cards 12, 16, 23 and 31, drawn in a 100×100 box. */
export type ShapeId = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'hexagon';
export const SHAPE_IDS: readonly ShapeId[] = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'];

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
};
