"""Shared constants for the BrainLink pipeline."""

from pathlib import Path

# ─── EEG hardware ─────────────────────────────────────────────────────
SAMPLE_RATE = 250           # HALO native sample rate (Hz)
CHANNELS = ["Fp1", "Fp2", "O1", "O2"]
HALO_ELECTRODE_MAP = {"Fp1": 0, "Fp2": 1, "O1": 2, "O2": 3}

# ─── Frequency bands (Hz) ─────────────────────────────────────────────
BANDS: dict[str, tuple[float, float]] = {
    "delta": (0.5, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta":  (13, 30),
    "gamma": (30, 45),
}

# ─── DSP / streaming ──────────────────────────────────────────────────
BUFFER_SAMPLES = SAMPLE_RATE * 2    # per-channel ring buffer: the 2 s the band powers are computed from
PSD_SEGMENT_SEC = 1.0               # Welch segment: 1 s Hann → 1 Hz bins (3 segments over the 2 s buffer)
WINDOW_SAMPLES = SAMPLE_RATE * 1    # 1 s: enough signal to start, and the blink counter's window
STREAM_HZ = 10                      # WebSocket push rate
PUSH_INTERVAL = 1.0 / STREAM_HZ

# ─── Paths ────────────────────────────────────────────────────────────
# Parents[1] resolves to the project root (one level above this package)
RECORDINGS_DIR = Path(__file__).resolve().parents[1] / "recordings"
