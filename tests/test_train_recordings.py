"""Training features from labelled recordings come from the live DSP pipeline (no hardware, no scikit-learn)."""

import csv
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from brainlink.constants import CHANNELS, SAMPLE_RATE  # noqa: E402
from brainlink.dsp import DSPPipeline  # noqa: E402

spec = importlib.util.spec_from_file_location("train_mental_states", ROOT / "models" / "train_mental_states.py")
train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train)


def write_recording(folder: Path, sid: str, seconds: float, label: str | None) -> dict:
    rng = np.random.default_rng(8)
    n = int(SAMPLE_RATE * seconds)
    t = np.arange(n) / SAMPLE_RATE
    raw = {ch: 5 * rng.normal(size=n) + (30 * np.sin(2 * np.pi * 10 * t) if ch.startswith("O") else 0) for ch in CHANNELS}
    with open(folder / f"{sid}_data.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "sample_idx"] + CHANNELS)
        for i in range(n):
            w.writerow([1000 + i / SAMPLE_RATE, i] + [round(float(raw[ch][i]), 6) for ch in CHANNELS])
    meta = {"session_id": sid, "name": sid}
    if label:
        meta["mental_state_label"] = label
    (folder / f"{sid}_meta.json").write_text(json.dumps(meta))
    return raw


def test_labelled_recordings_become_live_pipeline_features(tmp_path):
    write_recording(tmp_path, "relax1", 5.0, "relaxed")
    write_recording(tmp_path, "nolabel", 3.0, None)                   # unlabelled: skipped
    X, y = train.load_brainlink_recordings(tmp_path)

    # 5 s = 50 ticks; the 2 s buffer is full at tick 19, then one window per second: ticks 19, 29, 39, 49
    assert X.shape == (4, 25)
    assert list(y) == ["relaxed"] * 4

    # the same numbers as replaying the samples through DSPPipeline by hand
    with open(tmp_path / "relax1_data.csv") as f:
        rows = list(csv.DictReader(f))
    dsp, chunk = DSPPipeline(), SAMPLE_RATE // 10
    for start in range(0, 20 * chunk, chunk):
        dsp.push({ch: np.array([float(r[ch]) for r in rows[start:start + chunk]]) for ch in CHANNELS})
    assert np.allclose(X[0], train.extract_features(dsp.compute_band_powers()), rtol=1e-12)

    # occipital alpha (the 10 Hz rhythm on O1/O2) dominates the frontal alpha
    o1_alpha = X[:, train.CHANNELS.index("O1") * 5 + train.BANDS.index("alpha")]
    fp1_alpha = X[:, train.CHANNELS.index("Fp1") * 5 + train.BANDS.index("alpha")]
    assert np.all(o1_alpha > 20 * fp1_alpha)
