#!/usr/bin/env python3
"""
Generate parity fixtures for the TypeScript port in web/src/core.

The Python implementation (brainlink/fnirs*.py + SciPy) is the source of
truth: this script runs it on deterministic inputs and writes the inputs and
outputs to web/test/fixtures/*.json, which the Vitest suites replay against
the TypeScript code.

    python3 web/scripts/make_fixtures.py        (or: cd web && npm run fixtures)

Inputs are rounded *before* the reference runs on them, so both sides see
bit-identical inputs after the JSON round trip.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

import numpy as np
from scipy.signal import butter, find_peaks, sosfilt, sosfilt_zi, sosfiltfilt

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from brainlink.fnirs import (  # noqa: E402
    OPTICAL_CHANNELS, FNIRSConfig, FNIRSPipeline, _bandpass_sos, _hemo_sos,
)
from brainlink.fnirs_balance import BalanceConfig, BalanceTracker  # noqa: E402
from brainlink.fnirs_simulator import FNIRSSimulator  # noqa: E402
from brainlink.mendi_proto import Frame  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "test" / "fixtures"

FRAME_KEYS = ("acc_x", "acc_y", "acc_z", "ang_x", "ang_y", "ang_z", "temp",
              "ir_l", "red_l", "amb_l", "ir_r", "red_r", "amb_r", "ir_p", "red_p", "amb_p")


def rounded(a, nd: int) -> list:
    return [round(float(v), nd) for v in np.asarray(a).ravel()]


def write(name: str, data: dict):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False))
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KiB)")


# ─── dsp.json ─────────────────────────────────────────────────────────

def test_signal(fs: float, n: int, seed: int) -> np.ndarray:
    """Slow drift + cardiac-band and out-of-band sines + noise, with a DC offset."""
    rng = np.random.default_rng(seed)
    t = np.arange(n) / fs
    x = (10.0 + 3.0 * np.sin(2 * np.pi * 0.07 * t) + 1.5 * np.sin(2 * np.pi * 1.2 * t + 0.3)
         + 0.6 * np.sin(2 * np.pi * 4.1 * t) + 0.3 * rng.normal(size=n))
    return np.array(rounded(x, 6))


def filter_case(name: str, stages: list[dict], sos: np.ndarray, fs: float, seed: int) -> dict:
    # The stages must rebuild exactly the SOS the pipeline uses
    rebuilt = np.vstack([butter(s["order"], s["wn"], btype=s["btype"], output="sos") for s in stages])
    assert np.array_equal(rebuilt, sos), name
    x = test_signal(fs, 300, seed)
    y0, zf0 = sosfilt(sos, x, zi=np.zeros((len(sos), 2)))
    zi = sosfilt_zi(sos)
    y1, zf1 = sosfilt(sos, x, zi=zi * x[0])
    ntaps = 2 * len(sos) + 1 - min((sos[:, 2] == 0).sum(), (sos[:, 5] == 0).sum())
    padlen = int(3 * ntaps)
    short = x[: padlen + 1]
    return {
        "name": name,
        "fs": fs,
        "stages": stages,
        "sos": sos.tolist(),
        "zi": zi.tolist(),
        "padlen": padlen,
        "x": x.tolist(),
        "sosfilt": rounded(y0, 12),
        "sosfilt_zf": zf0.tolist(),
        "sosfilt_zi": rounded(y1, 12),
        "sosfilt_zi_zf": zf1.tolist(),
        "sosfiltfilt": rounded(sosfiltfilt(sos, x), 12),
        "sosfiltfilt_short": rounded(sosfiltfilt(sos, short), 12),
    }


def stage(order: int, wn, btype: str) -> dict:
    return {"order": order, "wn": wn if np.isscalar(wn) else list(wn), "btype": btype}


def dsp_fixture() -> dict:
    filters = []
    seed = 100
    for fs in (30.6, 25.0):
        nyq = fs / 2.0
        lp = stage(3, min(0.5, nyq * 0.95) / nyq, "low")
        filters.append(filter_case(f"hemo_lp@{fs}", [lp], _hemo_sos(FNIRSConfig(), fs), fs, seed))
        hp = stage(1, 0.01 / nyq, "high")
        filters.append(filter_case(f"hemo_hp@{fs}", [hp, lp],
                                   _hemo_sos(FNIRSConfig(hp_hz=0.01), fs), fs, seed + 1))
        for lo, hi in ((0.7, 3.5), (0.5, 2.5)):
            st = stage(3, [lo / nyq, min(hi, nyq * 0.95) / nyq], "band")
            filters.append(filter_case(f"band_{lo}-{hi}@{fs}", [st],
                                       _bandpass_sos(lo, hi, fs, order=3), fs, seed + 2))
        seed += 10
    # Plain designs: even-order high-pass, even-order low-pass, wide band (real poles), default band order
    for name, st in (("high2", stage(2, 0.1, "high")), ("low4", stage(4, 0.2, "low")),
                     ("band1_wide", stage(1, [0.05, 0.9], "band")),
                     ("band2", stage(2, [0.1, 0.3], "band"))):
        sos = butter(st["order"], st["wn"], btype=st["btype"], output="sos")
        filters.append(filter_case(name, [st], sos, 25.0, seed))
        seed += 1

    peaks = []

    def peak_case(name, x, distance=None, prominence=None):
        x = np.asarray(x, dtype=float)
        idx, _ = find_peaks(x, distance=distance, prominence=prominence)
        peaks.append({"name": name, "x": x.tolist(), "distance": distance,
                      "prominence": prominence, "indices": idx.tolist()})

    rng = np.random.default_rng(7)
    noise = rounded(np.cumsum(rng.normal(size=200)) + rng.normal(size=200), 6)
    peak_case("noise", noise)
    peak_case("noise_distance", noise, distance=5)
    peak_case("noise_distance_float", noise, distance=7.5)
    peak_case("noise_prominence", noise, prominence=1.0)
    peak_case("noise_both", noise, distance=3, prominence=0.5)
    peak_case("noise_both_large", noise, distance=12, prominence=2.5)
    plateaus = [3, 3, 1, 2, 2, 2, 1, 0, 4, 4, 0, 1, 1, 1, 1, 0.5, 6, 2, 5, 5, 5, 5, 5, 1, 2, 0, 7, 7, 7]
    peak_case("plateaus", plateaus)
    peak_case("plateaus_distance", plateaus, distance=4)
    peak_case("plateaus_prominence", plateaus, prominence=1.5)
    peak_case("ties_small", [0, 1, 0, 1, 0, 1, 0, 1, 0], distance=3)
    peak_case("short", [1.0, 2.0])
    peak_case("empty", [])

    # Heart-rate style: pulse-channel IR → demean → cardiac band-pass → troughs
    fs = 30.6
    sim = FNIRSSimulator(fs=fs, seed=3)
    ir = np.array([f.ir_p - f.amb_p for f in sim.generate(int(10 * fs))], dtype=float)
    x = sosfiltfilt(_bandpass_sos(0.7, 3.5, fs, order=3), ir - ir.mean())
    neg = np.array(rounded(-x, 9))
    peak_case("heart_rate", neg, distance=max(1, int(fs * 0.33)), prominence=float(np.std(neg) * 0.5))
    return {"filters": filters, "peaks": peaks, "round": round_cases()}


def round_cases() -> list:
    """Python's round(x, n): correctly rounded on the exact binary value, ties to even."""
    rng = np.random.default_rng(5)
    xs = ([float(v) for v in rng.normal(0, 50, 200)]
          + [k / 8 for k in range(-40, 41)]                    # exact binary halves
          + [k / 1000 + 0.0005 for k in range(-50, 50)]         # near-halves at 3 decimals
          + [0.15, 0.25, 0.35, 2.675, 1.0005, 0.0005, 1e-20, -1e-20, 123456.05, 61000.25, 0.0])
    return [[x, nd, round(x, nd)] for x in xs for nd in (0, 1, 2, 3, 4)]


# ─── pipeline.json ────────────────────────────────────────────────────

def frame_row(f: Frame) -> list:
    return [getattr(f, k) for k in FRAME_KEYS]


def row_frame(row: list) -> Frame:
    return Frame(**dict(zip(FRAME_KEYS, row, strict=True)))


def derived_json(out: dict) -> dict:
    return {k: [None if np.isnan(v) else round(float(v), 9) for v in arr] for k, arr in out.items()}


def checkpoint(pipe: FNIRSPipeline, after_push: int) -> dict:
    snap = pipe.snapshot()
    del snap["ts"], snap["measured_rate"]  # wall-clock dependent
    return {
        "after_push": after_push,
        "heart_rate": pipe.heart_rate(),
        "scalp_coupling": {ch: pipe.scalp_coupling(ch) for ch in OPTICAL_CHANNELS},
        "signal_quality": pipe.signal_quality(),
        "motion": pipe.motion(),
        "metrics": pipe.metrics(),
        "baseline_progress": pipe.baseline_progress,
        "baseline_ready": pipe.baseline_ready,
        "total_frames": pipe.total_frames,
        "snapshot": snap,
    }


def pipeline_run(name: str, fs: float, seed: int, config: dict, segments: list, batches,
                 every: int) -> dict:
    """``segments``: (state, seconds) or (state, seconds, "lift_left") to simulate a lifted optode."""
    sim = FNIRSSimulator(fs=fs, seed=seed)
    rows = []
    for seg in segments:
        sim.set_state(seg[0])
        for f in sim.generate(int(seg[1] * fs)):
            if len(seg) > 2 and seg[2] == "lift_left":
                f.ir_l = f.red_l = f.amb_l
            rows.append(frame_row(f))
    frames = [row_frame(r) for r in rows]  # what the TS side will see after JSON

    pipe = FNIRSPipeline(FNIRSConfig(**config), fs=fs)
    pushes, checkpoints, i = [], [], 0
    sizes = batches(len(frames))
    for k, n in enumerate(sizes):
        out = pipe.push(frames[i:i + n])
        i += n
        pushes.append({"n": n, "derived": derived_json(out)})
        if (k + 1) % every == 0 or k == len(sizes) - 1:
            checkpoints.append(checkpoint(pipe, k))
    assert i == len(frames)
    return {"name": name, "fs": fs, "config": config, "frame_keys": list(FRAME_KEYS),
            "frames": rows, "pushes": pushes, "checkpoints": checkpoints}


def pipeline_fixture() -> dict:
    def threes(total):
        return [3] * (total // 3) + ([total % 3] if total % 3 else [])

    def mixed(total):
        sizes, k = [], 0
        while sum(sizes) < total:
            n = (1, 5, 0, 7, 2, 30, 4)[k % 7]  # includes an empty push and one larger than a second
            sizes.append(min(n, total - sum(sizes)))
            k += 1
        return sizes

    main = pipeline_run(
        "main_30.6", 30.6, 11, {},
        [("rest", 16), ("task", 14), ("motion", 6), ("poor_contact", 10), ("lateral_right", 14)],
        threes, every=20)
    variant = pipeline_run(
        "hp_lifted_25", 25.0, 12, {"hp_hz": 0.02, "baseline_sec": 4.0, "activation_window_sec": 20.0},
        [("rest", 8), ("high_load", 8), ("rest", 6, "lift_left"), ("relax", 8)],
        mixed, every=10)
    return {"runs": [main, variant]}


# ─── balance.json ─────────────────────────────────────────────────────

class BalanceScript:
    """Drives a BalanceTracker and records each operation with the state that follows it."""

    def __init__(self, config: BalanceConfig, seed: int, t0: float):
        self.tracker = BalanceTracker(config)
        self.rng = np.random.default_rng(seed)
        self.t = t0
        self.ops: list[dict] = []

    def update(self, a, hold=None, dt=None):
        """One tick at the current time, then advance by ``dt`` (default ~0.1 s with jitter)."""
        a_json = "nan" if isinstance(a, float) and math.isnan(a) else a
        state = self.tracker.update(a, self.t, hold=hold)
        self.ops.append({"op": "update", "a": a_json, "t": self.t, "hold": hold, "state": state})
        self.t += dt if dt is not None else 0.1 + float(self.rng.uniform(-0.02, 0.02))

    def set_config(self, **kw):
        self.tracker.set_config(**kw)
        self.ops.append({"op": "set_config", "overrides": kw, "state": self.tracker.state()})

    def reset_stats(self):
        self.tracker.reset_stats()
        self.ops.append({"op": "reset_stats", "state": self.tracker.state()})

    def noisy(self, mu: float, sd: float) -> float:
        return round(float(mu + self.rng.normal(0, sd)), 6)


def balance_fixture() -> dict:
    initial = {"warmup_sec": 3.0, "dwell_sec": 2.0, "smoothing_sec": 1.5}
    s = BalanceScript(BalanceConfig(**initial), seed=21, t0=50.0)
    for _ in range(3):
        s.update(None)                                     # no baseline yet → waiting
    for _ in range(60):
        s.update(s.noisy(0.5, 0.006))                      # warmup, then balanced → focus
    for i in range(50):
        s.update(s.noisy(min(0.62, 0.5 + 0.004 * i), 0.004))  # drift right → pending → train_left
    s.set_config(smoothing_sec=0.0)
    for v in [0.5] * 10 + [0.465, 0.462, 0.459, 0.455, 0.462, 0.468, 0.47, 0.471, 0.5,
                           0.465, 0.459, 0.47, 0.53, 0.54, 0.535, 0.53]:
        s.update(v)                                        # hysteresis around both band edges
    for _ in range(30):
        s.update(s.noisy(0.40, 0.01))                      # left dominant → train_right
    for _ in range(15):
        s.update(0.6, hold="motion")
    for _ in range(10):
        s.update(0.6, hold="poor_signal")
    s.update(0.6, hold="")                                 # empty reason does not hold
    for _ in range(25):
        s.update(s.noisy(0.6, 0.005))
    s.update(0.6, dt=-0.05)
    s.update(0.6)                                          # clock stepped back → dt clamps to 0
    s.t = 80.0
    s.update(0.6, dt=2.0)                                  # long gap: restart (warmup again)
    s.update(0.6, dt=2.5)                                  # exactly 2.0 s later: no restart
    s.update(0.6)                                          # 2.5 s later: restart
    for _ in range(40):
        s.update(s.noisy(0.5, 0.004))
    s.update(float("nan"))                                 # non-finite → waiting
    s.reset_stats()
    s.set_config(low=0.45, high=0.55, hysteresis=0.0, dwell_sec=0.0, warmup_sec=0.0, smoothing_sec=4.0)
    for i in range(60):
        s.update(round(0.5 + 0.09 * math.sin(i / 6.0), 6))
    s.set_config(**asdict(BalanceConfig()))                # defaults: 15 s warmup, 5 s dwell
    for i in range(260):
        s.update(s.noisy(0.5 + (0.07 if i > 180 else 0.0), 0.003))
    s.update(None)
    return {"initial_config": initial, "ops": s.ops}


# ─── eeg.json ─────────────────────────────────────────────────────────

def eeg_fixture() -> dict:
    """EEG port (web/src/core/eeg, web/src/ble/halo.ts) against brainlink/dsp.py, features.py, halo_ble.py."""
    from scipy.signal import iirnotch, tf2sos, welch
    import brainlink.features as features_mod
    from brainlink.constants import CHANNELS, SAMPLE_RATE
    from brainlink.dsp import DSPPipeline
    from brainlink.features import FeatureEngine
    from brainlink.halo_ble import HALOBleAdapter
    from brainlink.simulator import EEGSimulator

    b, a = iirnotch(50.0, Q=30, fs=SAMPLE_RATE)
    notch = tf2sos(b, a)

    rng = np.random.default_rng(31)
    welch_cases = []
    for n in (250, 200, 128):
        t = np.arange(n) / SAMPLE_RATE
        x = np.array(rounded(4 * np.sin(2 * np.pi * 10 * t) + 2 * np.sin(2 * np.pi * 22 * t + 0.4)
                             + 1.5 * rng.normal(size=n) + 3.0, 6))
        f, p = welch(x, fs=SAMPLE_RATE, nperseg=min(128, n))
        welch_cases.append({"x": x.tolist(), "freqs": rounded(f, 12), "psd": rounded(p, 14)})

    # The simulator draws from NumPy's global generator: seed it, round its output, replay it in TS
    np.random.seed(5)
    sim = EEGSimulator()
    dsp = DSPPipeline()
    chunks, checkpoints = [], []
    plan = [("baseline", 30), ("focus", 25), ("stress", 25), ("eyes_closed", 20), ("flow", 20)]
    for state, ticks in plan:
        sim.set_state(state)
        for _ in range(ticks):
            raw = sim.generate(SAMPLE_RATE // 10)
            raw = {ch: np.array(rounded(raw[ch], 6)) for ch in CHANNELS}
            chunks.append({ch: raw[ch].tolist() for ch in CHANNELS})
            dsp.push(raw)
            cp = {"tick": len(chunks) - 1, "len": len(dsp.buffers["Fp1"]),
                  "tail": {ch: rounded(dsp.buffers[ch][-8:], 12) for ch in CHANNELS}}
            if dsp.has_enough():
                cp["band_powers"] = {ch: {k: round(v, 12) for k, v in bp.items()}
                                     for ch, bp in dsp.compute_band_powers().items()}
                cp["blinks"] = dsp.detect_blinks()
            checkpoints.append(cp)

    # Features: band powers with phases that trip every combo; the clock is the tick count / 10
    clock = {"t": 1000.0}
    features_mod.time.time = lambda: clock["t"]
    eng = FeatureEngine()
    rng = np.random.default_rng(17)
    feats = []

    def bands(fp_alpha, fp_beta, fp_theta, occ_alpha, jitter=0.05):
        def j(v):
            return round(float(v * (1 + jitter * rng.normal())), 6)
        out = {}
        for ch in CHANNELS:
            front = ch.startswith("Fp")
            out[ch] = {"delta": j(6.0), "theta": j(fp_theta if front else 3.0),
                       "alpha": j(fp_alpha if front else occ_alpha), "beta": j(fp_beta if front else 1.5), "gamma": j(0.6)}
        return out

    phases = [  # (ticks, fp_alpha, fp_beta, fp_theta, occ_alpha, blinks)
        (30, 4.0, 3.0, 5.0, 8.0, 1),     # baseline
        (60, 1.2, 4.0, 4.0, 1.3, 0),     # focus + high coherence → super_flow
        (40, 1.0, 3.0, 9.0, 20.0, 28),   # blinks → stress, low fronto-occipital coherence → panic
        (40, 3.0, 1.0, 2.0, 30.0, 0),    # strong occipital alpha, calm → zen_heal
        (40, 1.0, 3.5, 8.0, 1.0, 22),    # stress + focus → berserker
        (20, 0.005, 0.004, 0.003, 0.002, 0),  # tiny powers: the 0.01 floors
    ]
    for ticks, fa, fb, ft, oa, blinks in phases:
        for _ in range(ticks):
            clock["t"] = round(clock["t"] + 0.1, 1)
            bp = bands(fa, fb, ft, oa)
            res = eng.compute(bp, blinks)
            feats.append({"t": clock["t"], "band_powers": bp, "blinks": blinks, **res})

    # HALO packets: deltas incl. out-of-range first records, a footer-only and a malformed packet
    halo = object.__new__(HALOBleAdapter)
    halo._accum = [0.0] * 6
    halo._buffer = {ch: [] for ch in CHANNELS}
    halo._sample_rate = SAMPLE_RATE
    rng = np.random.default_rng(3)
    packets = []
    for k in range(12):
        n = int(rng.integers(1, 20))
        body = rng.integers(-40, 40, size=n * 6)
        if k % 3 == 0:
            body[:6] = rng.choice([-128, -127, 127, 120, -100, 5], size=6)
        pkt = bytes([int(v) & 0xFF for v in body]) + bytes([0x0F, k, 0, 0, 0, 0])
        packets.append(list(pkt))
    packets.insert(4, [0x0F, 1, 0, 0, 0, 0])          # footer only
    packets.insert(7, list(range(13)))                 # unexpected size
    outputs = []
    for pkt in packets:
        before = len(halo._buffer["Fp1"])
        halo._parse_eeg_packet(bytearray(pkt))
        outputs.append({ch: rounded(halo._buffer[ch][before:], 9) for ch in CHANNELS})

    return {"notch_sos": notch.tolist(), "welch": welch_cases, "chunks": chunks, "checkpoints": checkpoints,
            "features": feats, "halo": {"packets": packets, "outputs": outputs}}


FIXTURES = {"dsp": dsp_fixture, "pipeline": pipeline_fixture, "balance": balance_fixture, "eeg": eeg_fixture}

if __name__ == "__main__":
    # make_fixtures.py [name …] — all of them by default
    for name in sys.argv[1:] or FIXTURES:
        write(f"{name}.json", FIXTURES[name]())
