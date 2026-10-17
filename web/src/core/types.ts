/**
 * Data shapes shared by the pipeline, engine, storage and UI.
 *
 * Keys are snake_case on purpose: they mirror the Python server's JSON
 * (brainlink/fnirs.py `snapshot()`, fnirs_balance.py `state()`,
 * fnirs_recorder.py metadata), so frames, CSV files and session metadata are
 * interchangeable between the web app and the server.
 */

export type OpticalChannel = 'left' | 'right' | 'pulse';
export type HemoChannel = 'left' | 'right';
export const OPTICAL_CHANNELS: readonly OpticalChannel[] = ['left', 'right', 'pulse'];
export const HEMO_CHANNELS: readonly HemoChannel[] = ['left', 'right'];

export interface FNIRSConfig {
  red_nm: number;
  ir_nm: number;
  separation_cm: number;
  dpf_red: number;
  dpf_ir: number;
  baseline_sec: number;
  hp_hz: number;
  lp_hz: number;
  activation_window_sec: number;
  motion_gyro_dps: number;
  motion_accel_g: number;
}

/** Per-sample derived values aligned with the pushed frames; NaN while the baseline is collected. */
export interface Derived {
  hbo_left: Float64Array;
  hbr_left: Float64Array;
  hbo_right: Float64Array;
  hbr_right: Float64Array;
}

export type QualityLabel = 'warming_up' | 'light_leak' | 'no_signal' | 'good' | 'fair' | 'poor';

export interface ChannelQuality {
  sci: number | null;
  ambient_ratio: number | null;
  dc: number | null;
  label: QualityLabel;
}

export interface Metrics {
  activation: number | null;
  asymmetry: number | null;
}

export interface Snapshot {
  ts: number;
  baseline_ready: boolean;
  baseline_progress: number;
  hbo: Record<HemoChannel, number | null>;
  hbr: Record<HemoChannel, number | null>;
  preview: {
    hbo: Record<HemoChannel, number[]>;
    hbr: Record<HemoChannel, number[]>;
    pulse_ir: number[];
  };
  raw: Record<OpticalChannel, { ir: number; red: number; amb: number }> | null;
  imu: { accel_g: number[]; gyro_dps: number[]; temp_c: number | null } | null;
  heart_rate_bpm: number | null;
  quality: Record<OpticalChannel, ChannelQuality>;
  motion: boolean;
  metrics: Metrics;
  sample_rate: number;
  measured_rate: number | null;
  total_frames: number;
  config: FNIRSConfig;
}

export interface BalanceConfig {
  low: number;
  high: number;
  hysteresis: number;
  smoothing_sec: number;
  dwell_sec: number;
  warmup_sec: number;
}

export type Zone = 'left_dominant' | 'balanced' | 'right_dominant';
export type Recommendation = 'train_left' | 'train_right' | 'focus';
export type BalancePause = 'waiting' | 'warming_up' | 'motion' | 'poor_signal' | 'no_data' | 'off';

export interface BalanceState {
  asymmetry: number | null;
  raw: number | null;
  zone: Zone | null;
  recommendation: Recommendation | null;
  recommendation_sec: number | null;
  pending: { zone: Zone; recommendation: Recommendation; in_sec: number } | null;
  paused: BalancePause | null;
  warmup_left_sec: number | null;
  streak_sec: number;
  stats: {
    session_sec: number;
    balanced_sec: number;
    left_dominant_sec: number;
    right_dominant_sec: number;
    balanced_pct: number | null;
    best_streak_sec: number;
  };
  config: BalanceConfig;
}
