"""
fNIRS processing pipeline for the Mendi headband.

Raw Mendi frames carry, for each of three optical channels (left, right,
pulse), an infrared intensity, a red intensity and an ambient-light reading.
This module turns that into the quantities you would normally look at in an
fNIRS study:

1. **Ambient subtraction**     I = raw − ambient
2. **Optical density change**  ΔOD_λ = −log10(I_λ / I0_λ)   (I0 = baseline mean)
3. **Modified Beer–Lambert**   ΔOD_λ = (ε_HbO,λ·ΔHbO + ε_HbR,λ·ΔHbR) · d · DPF_λ
   solved per sample for ΔHbO / ΔHbR (µM)
4. **Causal filtering**: 3rd-order low-pass (0.5 Hz) to drop the cardiac pulse.
   An optional 1st-order high-pass (``hp_hz``) removes drift, but any causal
   high-pass also shrinks sustained (>10 s) responses, so it is off by default.
   Raw intensities are recorded, so do proper zero-phase filtering offline
   (e.g. MNE-NIRS) and use :meth:`FNIRSPipeline.reset` to re-baseline live.
5. Extras: heart rate from the pulse channel, a scalp-coupling index (SCI)
   per channel, and a motion flag from the IMU.

⚠️  Absolute values are only as good as the geometry assumptions.  Mendi does
not publish its LED wavelengths, source–detector separation or DPF, so the
defaults below (660 nm / 850 nm, 3 cm, DPF 6) are typical consumer-fNIRS
values.  Treat ΔHbO/ΔHbR as *relative* changes and tune ``FNIRSConfig`` if
you obtain better numbers.
"""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from scipy.signal import butter, find_peaks, sosfilt, sosfilt_zi, sosfiltfilt

from .mendi_proto import Frame

# ─── Constants ────────────────────────────────────────────────────────

# Measured 30.6 Hz on firmware 1.0.1 (upstream assumes 25 Hz, unmeasured).
# FNIRSPipeline.adapt_rate() corrects this from the observed rate anyway.
MENDI_SAMPLE_RATE = 30.6
OPTICAL_CHANNELS = ("left", "right", "pulse")
HEMO_CHANNELS = ("left", "right")        # channels used for HbO/HbR
_CH_KEYS = {"left": "l", "right": "r", "pulse": "p"}

# Molar extinction coefficients, cm⁻¹·M⁻¹ (base-10), from S. Prahl's
# compilation (omlc.org/spectra/hemoglobin).  (HbO2, Hb)
EXTINCTION: dict[int, tuple[float, float]] = {
    660: (319.6, 3226.56),
    690: (276.0, 2051.96),
    730: (390.0, 1102.2),
    760: (586.0, 1548.52),
    780: (710.0, 1075.44),
    810: (864.0, 717.08),
    830: (974.0, 693.04),
    850: (1058.0, 691.32),
    880: (1170.0, 726.44),
    905: (1206.0, 772.28),
    940: (1214.0, 693.44),
}


@dataclass
class FNIRSConfig:
    red_nm: int = 660
    ir_nm: int = 850
    separation_cm: float = 3.0
    dpf_red: float = 6.0
    dpf_ir: float = 6.0
    baseline_sec: float = 10.0       # seconds averaged to define I0
    hp_hz: float = 0.0               # optional drift high-pass (1st order); 0 = off
    lp_hz: float = 0.5               # removes cardiac pulse from HbO/HbR
    activation_window_sec: float = 60.0
    motion_gyro_dps: float = 20.0    # gyro magnitude above this → motion
    motion_accel_g: float = 0.15     # |‖a‖ − 1 g| above this → motion

    def validate(self, fs: float = MENDI_SAMPLE_RATE):
        for k, v in asdict(self).items():
            if not math.isfinite(v):
                raise ValueError(f"{k} must be a finite number")
        for nm in (self.red_nm, self.ir_nm):
            if nm not in EXTINCTION:
                raise ValueError(f"No extinction data for {nm} nm. Known: {sorted(EXTINCTION)}")
        if self.red_nm == self.ir_nm:
            raise ValueError("red_nm and ir_nm must differ")
        if not math.isfinite(fs) or fs <= 0:
            raise ValueError("fs must be a positive, finite number")
        if self.lp_hz <= 0:
            raise ValueError("lp_hz must be positive")
        if not 0 <= self.hp_hz < min(self.lp_hz, fs / 2.0 * 0.95):
            raise ValueError(f"need 0 <= hp_hz < lp_hz and hp_hz < {fs / 2.0 * 0.95:g} Hz (Nyquist)")
        if self.separation_cm <= 0 or self.dpf_red <= 0 or self.dpf_ir <= 0:
            raise ValueError("separation_cm and DPF must be positive")
        if self.baseline_sec <= 0 or self.activation_window_sec <= 0:
            raise ValueError("baseline_sec and activation_window_sec must be positive")


def _sigmoid(x: float) -> float:
    # Clamp: a lifted optode gives |ΔHb| in the hundreds of µM, and math.exp overflows past ~709
    return 1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, x))))


def mbll_matrix_inv(cfg: FNIRSConfig) -> np.ndarray:
    """Return the 2×2 matrix M⁻¹ with [ΔHbO, ΔHbR]ᵀ (µM) = M⁻¹ · [ΔOD_red, ΔOD_ir]ᵀ."""
    e_red = EXTINCTION[cfg.red_nm]
    e_ir = EXTINCTION[cfg.ir_nm]
    m = np.array([
        [e_red[0] * cfg.separation_cm * cfg.dpf_red, e_red[1] * cfg.separation_cm * cfg.dpf_red],
        [e_ir[0] * cfg.separation_cm * cfg.dpf_ir,   e_ir[1] * cfg.separation_cm * cfg.dpf_ir],
    ])
    return np.linalg.inv(m) * 1e6  # M → µM


class _CausalFilter:
    """Streaming cascade of Butterworth SOS sections that keeps its own state."""

    def __init__(self, sos: np.ndarray):
        self.sos = sos
        self.zi: Optional[np.ndarray] = None

    def __call__(self, x: np.ndarray) -> np.ndarray:
        if x.size == 0:
            return x
        if self.zi is None:
            self.zi = sosfilt_zi(self.sos) * x[0]
        y, self.zi = sosfilt(self.sos, x, zi=self.zi)
        return y


def _hemo_sos(cfg: "FNIRSConfig", fs: float) -> np.ndarray:
    nyq = fs / 2.0
    lp = butter(3, min(cfg.lp_hz, nyq * 0.95) / nyq, btype="low", output="sos")
    if cfg.hp_hz <= 0:
        return lp
    hp = butter(1, cfg.hp_hz / nyq, btype="high", output="sos")
    return np.vstack([hp, lp])


def _bandpass_sos(lo: float, hi: float, fs: float, order: int = 2) -> np.ndarray:
    nyq = fs / 2.0
    hi = min(hi, nyq * 0.95)
    return butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")


# ─── Pipeline ─────────────────────────────────────────────────────────

class FNIRSPipeline:
    """
    Streaming fNIRS processor.

    Call :meth:`push` with every batch of new :class:`Frame` objects, then
    :meth:`snapshot` to get the latest derived values for the UI / WebSocket.
    """

    def __init__(self, config: Optional[FNIRSConfig] = None, fs: float = MENDI_SAMPLE_RATE):
        self.config = config or FNIRSConfig()
        self.config.validate(fs)
        self.fs = fs
        self.history_sec = 30.0
        self.reset()

    # ── Lifecycle ──────────────────────────────────────────────────
    def reset(self):
        """Forget the baseline and all history (e.g. after re-seating the band)."""
        cap = int(self.history_sec * self.fs)
        self._minv = mbll_matrix_inv(self.config)
        self._baseline_acc: dict[str, list[list[float]]] = {
            ch: [[], []] for ch in HEMO_CHANNELS  # [red], [ir]
        }
        self.baseline: dict[str, Optional[tuple[float, float]]] = {ch: None for ch in HEMO_CHANNELS}
        self._baseline_target = max(1, int(self.config.baseline_sec * self.fs))

        hemo_sos = _hemo_sos(self.config, self.fs)
        self._filters = {
            (ch, s): _CausalFilter(hemo_sos) for ch in HEMO_CHANNELS for s in ("hbo", "hbr")
        }
        self.hbo = {ch: deque(maxlen=cap) for ch in HEMO_CHANNELS}
        self.hbr = {ch: deque(maxlen=cap) for ch in HEMO_CHANNELS}
        # Ambient-corrected intensities for SCI / heart rate (last 10 s)
        icap = int(10 * self.fs)
        self.intensity = {
            ch: {"red": deque(maxlen=icap), "ir": deque(maxlen=icap)} for ch in OPTICAL_CHANNELS
        }
        self.ambient_ratio = {ch: deque(maxlen=icap) for ch in OPTICAL_CHANNELS}
        self._motion = deque(maxlen=int(2 * self.fs))
        # Long window of HbO-HbR for activation normalisation
        self._act_hist = deque(maxlen=int(self.config.activation_window_sec * self.fs))
        self.last_frame: Optional[Frame] = None
        self.total_frames = 0
        self._rate_t0: Optional[float] = None
        self._rate_n = 0
        self.measured_rate: Optional[float] = None

    def set_config(self, **overrides) -> FNIRSConfig:
        cfg = FNIRSConfig(**{**asdict(self.config), **overrides})
        cfg.validate(self.fs)
        old, self.config = self.config, cfg
        try:
            self.reset()
        except Exception:
            self.config = old  # never leave a config whose filters could not be built
            self.reset()
            raise
        return cfg

    def set_rate(self, fs: float):
        """Change the sample rate (filters, buffers); resets the baseline."""
        self.config.validate(fs)
        self.fs = fs
        self.reset()

    def adapt_rate(self, tolerance: float = 0.1) -> bool:
        """Switch to the measured rate when it is more than ``tolerance`` off. Returns True if changed."""
        m = self.measured_rate
        if not m or abs(m - self.fs) / self.fs <= tolerance:
            return False
        self.set_rate(round(m, 1))
        return True

    @property
    def baseline_ready(self) -> bool:
        return all(b is not None for b in self.baseline.values())

    @property
    def baseline_progress(self) -> float:
        n = min(len(self._baseline_acc[ch][0]) for ch in HEMO_CHANNELS)
        return 1.0 if self.baseline_ready else round(n / self._baseline_target, 3)

    # ── Ingest ─────────────────────────────────────────────────────
    def push(self, frames: list[Frame]) -> dict[str, np.ndarray]:
        """
        Process a batch of frames.  Returns per-sample derived arrays
        (``hbo_left``, ``hbr_left``, ``hbo_right``, ``hbr_right``) aligned with
        the input, NaN while the baseline is still being collected.
        """
        n = len(frames)
        out = {f"{s}_{ch}": np.full(n, np.nan) for ch in HEMO_CHANNELS for s in ("hbo", "hbr")}
        if n == 0:
            return out
        self._track_rate(n)
        self.total_frames += n
        self.last_frame = frames[-1]

        raw = {
            ch: {
                k: np.array([getattr(f, f"{k}_{_CH_KEYS[ch]}") for f in frames], dtype=float)
                for k in ("ir", "red", "amb")
            }
            for ch in OPTICAL_CHANNELS
        }
        corr = {
            ch: {
                "red": np.maximum(raw[ch]["red"] - raw[ch]["amb"], 1.0),
                "ir": np.maximum(raw[ch]["ir"] - raw[ch]["amb"], 1.0),
            }
            for ch in OPTICAL_CHANNELS
        }
        for ch in OPTICAL_CHANNELS:
            self.intensity[ch]["red"].extend(corr[ch]["red"])
            self.intensity[ch]["ir"].extend(corr[ch]["ir"])
            denom = np.maximum(raw[ch]["ir"], 1.0)
            self.ambient_ratio[ch].extend(np.abs(raw[ch]["amb"]) / denom)

        for f in frames:
            ax, ay, az = f.accel_g
            gx, gy, gz = f.gyro_dps
            a_dev = abs(math.sqrt(ax * ax + ay * ay + az * az) - 1.0)
            g_mag = math.sqrt(gx * gx + gy * gy + gz * gz)
            moving = (a_dev > self.config.motion_accel_g and (ax or ay or az)) or \
                g_mag > self.config.motion_gyro_dps
            self._motion.append(bool(moving))

        for ch in HEMO_CHANNELS:
            red, ir = corr[ch]["red"], corr[ch]["ir"]
            start = 0
            if self.baseline[ch] is None:
                acc = self._baseline_acc[ch]
                need = self._baseline_target - len(acc[0])
                take = min(need, n)
                acc[0].extend(red[:take])
                acc[1].extend(ir[:take])
                start = take
                if len(acc[0]) >= self._baseline_target:
                    self.baseline[ch] = (float(np.mean(acc[0])), float(np.mean(acc[1])))
            if self.baseline[ch] is None or start >= n:
                continue
            i0_red, i0_ir = self.baseline[ch]
            od = np.vstack([
                -np.log10(red[start:] / i0_red),
                -np.log10(ir[start:] / i0_ir),
            ])
            conc = self._minv @ od                 # rows: HbO, HbR (µM)
            hbo = self._filters[(ch, "hbo")](conc[0])
            hbr = self._filters[(ch, "hbr")](conc[1])
            self.hbo[ch].extend(hbo)
            self.hbr[ch].extend(hbr)
            out[f"hbo_{ch}"][start:] = hbo
            out[f"hbr_{ch}"][start:] = hbr

        if self.baseline_ready:
            hb_l = out["hbo_left"] - out["hbr_left"]
            hb_r = out["hbo_right"] - out["hbr_right"]
            both = (hb_l + hb_r) / 2.0  # NaN where either side is still warming up
            self._act_hist.extend(float(v) for v in both if not np.isnan(v))
        return out

    def _track_rate(self, n: int):
        now = time.monotonic()
        if self._rate_t0 is None:
            self._rate_t0 = now
            return
        self._rate_n += n
        dt = now - self._rate_t0
        if dt >= 5.0:
            self.measured_rate = round(self._rate_n / dt, 2)
            self._rate_t0, self._rate_n = now, 0

    # ── Derived metrics ────────────────────────────────────────────
    def heart_rate(self) -> Optional[float]:
        """Beats per minute from the pulse channel's IR intensity (last ~10 s)."""
        ir = np.asarray(self.intensity["pulse"]["ir"], dtype=float)
        if ir.size < self.fs * 6:
            return None
        x = ir - np.mean(ir)
        try:
            x = sosfiltfilt(_bandpass_sos(0.7, 3.5, self.fs, order=3), x)
        except ValueError:
            return None
        # Blood volume ↑ → light ↓, so pulses are troughs of intensity
        peaks, _ = find_peaks(-x, distance=max(1, int(self.fs * 0.33)),
                              prominence=np.std(x) * 0.5)
        if len(peaks) < 4:
            return None
        ibi = np.diff(peaks) / self.fs
        ibi = ibi[(ibi > 0.28) & (ibi < 1.5)]
        if ibi.size < 3:
            return None
        return round(60.0 / float(np.median(ibi)), 1)

    def scalp_coupling(self, ch: str) -> Optional[float]:
        """
        Scalp Coupling Index (Pollonini et al., 2014): correlation of the two
        wavelengths after band-passing to the cardiac band.  > 0.75 is good.
        """
        red = np.asarray(self.intensity[ch]["red"], dtype=float)
        ir = np.asarray(self.intensity[ch]["ir"], dtype=float)
        if red.size < self.fs * 5:
            return None
        try:
            sos = _bandpass_sos(0.5, 2.5, self.fs, order=3)
            r = sosfiltfilt(sos, red - red.mean())
            i = sosfiltfilt(sos, ir - ir.mean())
        except ValueError:
            return None
        if np.std(r) < 1e-9 or np.std(i) < 1e-9:
            return 0.0
        return round(float(np.corrcoef(r, i)[0, 1]), 3)

    def signal_quality(self) -> dict:
        q = {}
        for ch in OPTICAL_CHANNELS:
            sci = self.scalp_coupling(ch)
            amb = float(np.mean(self.ambient_ratio[ch])) if self.ambient_ratio[ch] else None
            ir = self.intensity[ch]["ir"]
            dc = float(np.mean(ir)) if ir else None
            if sci is None:
                label = "warming_up"
            elif amb is not None and amb > 0.5:
                label = "light_leak"
            elif dc is not None and dc < 100:
                label = "no_signal"
            elif sci >= 0.75:
                label = "good"
            elif sci >= 0.5:
                label = "fair"
            else:
                label = "poor"
            q[ch] = {"sci": sci, "ambient_ratio": None if amb is None else round(amb, 3),
                     "dc": None if dc is None else round(dc, 1), "label": label}
        return q

    def motion(self) -> bool:
        return bool(self._motion) and (sum(self._motion) / len(self._motion)) > 0.2

    def metrics(self) -> dict:
        """
        Game-friendly 0–1 values:

        * ``activation`` — prefrontal oxygenation (ΔHbO − ΔHbR, both sides)
          relative to its recent distribution (sigmoid of a z-score).
        * ``asymmetry``  — right minus left oxygenation, mapped to 0..1
          (0.5 = balanced).
        """
        if not self.baseline_ready or not self.hbo["left"]:
            return {"activation": None, "asymmetry": None}
        hist = np.asarray(self._act_hist, dtype=float)
        cur_l = self.hbo["left"][-1] - self.hbr["left"][-1]
        cur_r = self.hbo["right"][-1] - self.hbr["right"][-1]
        cur = (cur_l + cur_r) / 2.0
        sd = float(np.std(hist)) if hist.size > self.fs * 5 else 0.0
        if sd < 1e-6:
            activation = 0.5
        else:
            z = (cur - float(np.mean(hist))) / sd
            activation = _sigmoid(z)
        scale = max(sd, 0.05)
        asym = _sigmoid((cur_r - cur_l) / scale)
        return {"activation": round(activation, 3), "asymmetry": round(asym, 3)}

    def snapshot(self, preview_sec: float = 10.0) -> dict:
        n = int(preview_sec * self.fs)
        step = max(1, int(self.fs / 5))  # ~5 points per second for the UI

        def tail(d):
            arr = list(d)[-n:]
            return [round(float(v), 4) for v in arr[::step]]

        f = self.last_frame
        return {
            "ts": int(time.time() * 1000),
            "baseline_ready": self.baseline_ready,
            "baseline_progress": self.baseline_progress,
            "hbo": {ch: (round(float(self.hbo[ch][-1]), 4) if self.hbo[ch] else None) for ch in HEMO_CHANNELS},
            "hbr": {ch: (round(float(self.hbr[ch][-1]), 4) if self.hbr[ch] else None) for ch in HEMO_CHANNELS},
            "preview": {
                "hbo": {ch: tail(self.hbo[ch]) for ch in HEMO_CHANNELS},
                "hbr": {ch: tail(self.hbr[ch]) for ch in HEMO_CHANNELS},
                "pulse_ir": [round(float(v), 1) for v in list(self.intensity["pulse"]["ir"])[-int(5 * self.fs):]],
            },
            "raw": None if f is None else {
                ch: {k: getattr(f, f"{k}_{_CH_KEYS[ch]}") for k in ("ir", "red", "amb")}
                for ch in OPTICAL_CHANNELS
            },
            "imu": None if f is None else {
                "accel_g": [round(v, 3) for v in f.accel_g],
                "gyro_dps": [round(v, 2) for v in f.gyro_dps],
                "temp_c": round(f.temp, 2) if math.isfinite(f.temp) else None,
            },
            "heart_rate_bpm": self.heart_rate(),
            "quality": self.signal_quality(),
            "motion": self.motion(),
            "metrics": self.metrics(),
            "sample_rate": self.fs,
            "measured_rate": self.measured_rate,
            "total_frames": self.total_frames,
            "config": asdict(self.config),
        }
