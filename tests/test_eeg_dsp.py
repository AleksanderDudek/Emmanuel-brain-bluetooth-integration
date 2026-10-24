"""Tests for the EEG band-power estimator (no hardware needed)."""

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brainlink.constants import BANDS, BUFFER_SAMPLES, CHANNELS, SAMPLE_RATE  # noqa: E402
from brainlink.dsp import DSPPipeline, band_densities, band_powers  # noqa: E402


def tone(hz: float, seconds: float = 2.0, amplitude: float = 1.0, phase: float = 0.3) -> np.ndarray:
    t = np.arange(int(SAMPLE_RATE * seconds)) / SAMPLE_RATE
    return amplitude * np.sin(2 * np.pi * hz * t + phase)


@pytest.mark.parametrize("nperseg", [250, 128])
def test_flat_spectrum_reads_the_same_in_every_band_at_any_resolution(nperseg):
    df = SAMPLE_RATE / nperseg
    freqs = np.arange(nperseg // 2 + 1) * df
    dens = band_densities(freqs, np.ones_like(freqs), df)
    assert dens == pytest.approx({band: 1.0 for band in BANDS}, abs=1e-12)


@pytest.mark.parametrize("nperseg", [250, 128])
def test_edge_bins_are_split_between_bands_not_counted_twice(nperseg):
    df = SAMPLE_RATE / nperseg
    freqs = np.arange(nperseg // 2 + 1) * df
    psd = 1 + freqs / 10
    dens = band_densities(freqs, psd, df)
    total = sum(dens[band] * (hi - lo) for band, (lo, hi) in BANDS.items())
    lo, hi = min(b[0] for b in BANDS.values()), max(b[1] for b in BANDS.values())
    inside = np.clip(freqs + df / 2, lo, hi) - np.clip(freqs - df / 2, lo, hi)
    assert total == pytest.approx(float(np.sum(psd * inside)), rel=1e-12)


def test_a_10_hz_rhythm_keeps_its_power_in_alpha():
    bp = band_powers(tone(10, amplitude=4, phase=0))
    assert bp["alpha"] * 5 == pytest.approx(8.0, rel=1e-9)     # A²/2 µV² over the 5 Hz band
    assert bp["theta"] < 1e-9 and bp["beta"] < 1e-9


def test_a_9_hz_alpha_peak_barely_reads_as_theta():
    # issue #1: with 1.95 Hz bins on the last second, theta/alpha was 0.72 for a pure 9 Hz rhythm
    bp = band_powers(tone(9))
    assert bp["theta"] / bp["alpha"] < 0.15


def test_pipeline_uses_the_whole_two_second_buffer_with_one_hz_bins():
    dsp = DSPPipeline()
    rng = np.random.default_rng(4)
    for _ in range(30):                                      # 3 s in 0.1 s chunks
        dsp.push({ch: 20 * rng.normal(size=SAMPLE_RATE // 10) for ch in CHANNELS})
    assert len(dsp.buffers["Fp1"]) == BUFFER_SAMPLES
    bp = dsp.compute_band_powers()
    for ch in CHANNELS:
        assert bp[ch] == pytest.approx(band_powers(dsp.buffers[ch]), rel=1e-12)
