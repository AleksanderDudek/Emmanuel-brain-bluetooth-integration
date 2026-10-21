/**
 * EEG shapes and constants (brainlink/constants.py).  BrainAccess HALO: four
 * dry electrodes, two frontal (Fp1, Fp2) and two occipital (O1, O2), 250 Hz.
 */

export const EEG_SAMPLE_RATE = 250;
export const EEG_CHANNELS = ['Fp1', 'Fp2', 'O1', 'O2'] as const;
export type EegChannel = (typeof EEG_CHANNELS)[number];

export const BANDS = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
} as const satisfies Record<string, readonly [number, number]>;
export type Band = keyof typeof BANDS;
export const BAND_NAMES = Object.keys(BANDS) as Band[];

/** One-second analysis window. */
export const WINDOW_SAMPLES = EEG_SAMPLE_RATE;

/** Samples per channel in µV, oldest first. */
export type EegChunk = Record<EegChannel, ArrayLike<number>>;
export type BandPowers = Record<EegChannel, Record<Band, number>>;

export const EEG_METRICS = ['focus', 'calm', 'valence', 'instability', 'stress', 'flow'] as const;
export type EegMetric = (typeof EEG_METRICS)[number];
export type EegMetrics = Record<EegMetric, number>;
