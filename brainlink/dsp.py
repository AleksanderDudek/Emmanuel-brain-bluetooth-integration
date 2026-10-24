"""DSP pipeline: ring-buffer management, band-power extraction, blink detection."""

import numpy as np
from scipy.signal import butter, iirnotch, sosfilt, welch

from .constants import BANDS, BUFFER_SAMPLES, CHANNELS, PSD_SEGMENT_SEC, SAMPLE_RATE, WINDOW_SAMPLES


def band_densities(freqs: np.ndarray, psd: np.ndarray, df: float) -> dict[str, float]:
    """
    Mean power density of each band (µV²/Hz): the PSD integrated over the band, each
    bin weighted by the part of its width [f − df/2, f + df/2] inside the band, then
    divided by the band's width.  Bins on a band edge are split between the two bands
    instead of counted twice, and the result does not depend on the bin width.
    """
    out = {}
    for band, (lo, hi) in BANDS.items():
        inside = np.clip(freqs + df / 2, lo, hi) - np.clip(freqs - df / 2, lo, hi)
        out[band] = float(np.sum(psd * inside) / (hi - lo))
    return out


def band_powers(signal: np.ndarray, fs: float = SAMPLE_RATE) -> dict[str, float]:
    """
    Band power densities {band: µV²/Hz} of one channel by Welch's method: 1 s Hann
    segments (1 Hz bins) with 50 % overlap over all of ``signal`` — three averaged
    segments for the live 2 s buffer.  The one estimator for live metrics and training.
    """
    nperseg = min(round(fs * PSD_SEGMENT_SEC), len(signal))
    freqs, psd = welch(signal, fs=fs, nperseg=nperseg)
    return band_densities(freqs, psd, fs / nperseg)


class DSPPipeline:
    """
    Maintains per-channel ring buffers and computes spectral features.

    Usage::

        dsp = DSPPipeline()
        dsp.push(raw_data)           # raw_data: {ch: np.ndarray}
        if dsp.has_enough():
            powers = dsp.compute_band_powers()
            blinks = dsp.detect_blinks()
    """

    # Exponential MA time constant for DC/drift removal.
    # τ = 0.5 s → HP cutoff ≈ 0.3 Hz; converges to 95 % in ~1.5 s.
    # (Previous τ=2 s was too slow: electrodes still drifting after 6 s.)
    _HP_ALPHA: float = float(np.exp(-1.0 / (SAMPLE_RATE * 0.5)))

    def __init__(self):
        self.buffers: dict[str, np.ndarray] = {ch: np.array([]) for ch in CHANNELS}
        # Running low-pass state used for HP = signal − LP (DC baseline).
        # Initialised to None; seeded from the first sample of each channel.
        self._hp_state: dict[str, float | None] = {ch: None for ch in CHANNELS}
        # 50 Hz notch filter (Europe/Poland mains) applied before buffering.
        # Quality factor Q=30 gives ~1.7 Hz notch width.
        b_notch, a_notch = iirnotch(50.0, Q=30, fs=SAMPLE_RATE)
        # Convert to SOS for numerical stability
        from scipy.signal import tf2sos
        self._notch_sos = tf2sos(b_notch, a_notch)
        self._notch_state: dict[str, np.ndarray | None] = {ch: None for ch in CHANNELS}
        # Per-band SOS bandpass filters
        self._filters = {
            band: butter(4, [lo, hi], btype="band", fs=SAMPLE_RATE, output="sos")
            for band, (lo, hi) in BANDS.items()
        }

    def push(self, data: dict[str, np.ndarray]):
        """DC-remove + 50 Hz notch + buffer each channel (ring, max 2 s)."""
        a = self._HP_ALPHA
        for ch in CHANNELS:
            raw = data[ch].astype(float)
            if len(raw) == 0:
                continue

            # ── Step 1: remove DC / slow electrode drift (HP via LP subtraction)
            if self._hp_state[ch] is None:
                # Seed at median of first chunk for robustness against
                # single spike outliers at stream start.
                self._hp_state[ch] = float(np.median(raw))
            lp = self._hp_state[ch]
            hp = np.empty_like(raw)
            for i, x in enumerate(raw):
                lp = a * lp + (1.0 - a) * x
                hp[i] = x - lp
            self._hp_state[ch] = lp

            # ── Step 2: 50 Hz notch (mains interference)
            if self._notch_state[ch] is None:
                # zi shape: (n_sections, 2) — one initial condition per section
                from scipy.signal import sosfilt_zi
                self._notch_state[ch] = sosfilt_zi(self._notch_sos) * hp[0]
            notched, self._notch_state[ch] = sosfilt(
                self._notch_sos, hp, zi=self._notch_state[ch]
            )

            self.buffers[ch] = np.concatenate([self.buffers[ch], notched])
            if len(self.buffers[ch]) > BUFFER_SAMPLES:
                self.buffers[ch] = self.buffers[ch][-BUFFER_SAMPLES:]

    def has_enough(self) -> bool:
        """Return True when all channels hold at least one full Welch segment (1 s)."""
        return all(len(self.buffers[ch]) >= WINDOW_SAMPLES for ch in CHANNELS)

    def compute_band_powers(self) -> dict[str, dict[str, float]]:
        """Return per-channel band power densities {channel: {band: µV²/Hz}} over the whole buffer."""
        return {ch: band_powers(self.buffers[ch]) for ch in CHANNELS}

    def detect_blinks(self) -> int:
        """Count blink artifacts in the last second using frontal channels."""
        count = 0
        for ch in ("Fp1", "Fp2"):
            buf = self.buffers[ch][-WINDOW_SAMPLES:]
            threshold = np.std(buf) * 4
            peaks = np.where(np.abs(buf) > threshold)[0]
            if len(peaks) > 0:
                count += 1 + int(np.sum(np.diff(peaks) > 20))
        return count
