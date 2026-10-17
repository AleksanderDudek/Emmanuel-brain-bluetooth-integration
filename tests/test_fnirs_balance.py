"""Tests for the hemispheric balance trainer (no hardware needed)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brainlink.fnirs import FNIRSPipeline  # noqa: E402
from brainlink.fnirs_balance import BalanceConfig, BalanceTracker  # noqa: E402
from brainlink.fnirs_simulator import FNIRSSimulator  # noqa: E402

FAST = dict(smoothing_sec=0.0, dwell_sec=1.0, warmup_sec=1.0)


def feed(tracker, values, t0=0.0, dt=0.1, hold=None):
    """Feed a sequence of asymmetry values at 10 Hz; returns (last state, next time)."""
    t, st = t0, None
    for v in values:
        st = tracker.update(v, t, hold=hold)
        t += dt
    return st, t


def test_config_validation():
    for bad in ({"low": 0.6, "high": 0.5}, {"low": 0.0}, {"high": 1.0}, {"low": float("nan")},
                {"hysteresis": 0.5}, {"dwell_sec": -1}, {"smoothing_sec": True}):
        with pytest.raises(ValueError):
            BalanceTracker().set_config(**bad)
    with pytest.raises(TypeError):
        BalanceTracker().set_config(bogus=1)
    assert BalanceTracker().set_config(low=0.45, high=0.55).low == 0.45


def test_waiting_then_warmup():
    tr = BalanceTracker(BalanceConfig(warmup_sec=2.0))
    assert tr.update(None, 0.0)["paused"] == "waiting"
    st, t = feed(tr, [0.5] * 10)                       # 1 s of data
    assert st["paused"] == "warming_up" and 0.9 <= st["warmup_left_sec"] <= 1.2
    st, _ = feed(tr, [0.5] * 15, t)
    assert st["paused"] is None and st["zone"] == "balanced"


def test_recommendation_needs_dwell():
    tr = BalanceTracker(BalanceConfig(**FAST))
    st, t = feed(tr, [0.6] * 15)                       # warmup 1 s, then 0.5 s right-dominant
    assert st["zone"] == "right_dominant" and st["recommendation"] is None
    assert st["pending"]["recommendation"] == "train_left" and st["pending"]["in_sec"] > 0
    st, t = feed(tr, [0.6] * 10, t)
    assert st["recommendation"] == "train_left" and st["pending"] is None
    st, t = feed(tr, [0.4] * 12, t)
    assert st["recommendation"] == "train_right"
    st, _ = feed(tr, [0.5] * 12, t)
    assert st["recommendation"] == "focus"


def test_hysteresis():
    tr = BalanceTracker(BalanceConfig(**FAST))          # band 0.47..0.53, margin 0.01
    st, t = feed(tr, [0.5] * 12)
    assert st["zone"] == "balanced"
    st, t = feed(tr, [0.465], t)                        # inside the margin: stays balanced
    assert st["zone"] == "balanced"
    st, t = feed(tr, [0.455], t)
    assert st["zone"] == "left_dominant"
    st, _ = feed(tr, [0.465], t)                        # must reach 0.47 to re-enter
    assert st["zone"] == "left_dominant"


def test_smoothing_ignores_a_single_spike():
    tr = BalanceTracker(BalanceConfig(smoothing_sec=4.0, dwell_sec=1.0, warmup_sec=0.5))
    st, t = feed(tr, [0.5] * 20)
    st, _ = feed(tr, [0.95], t)
    assert st["zone"] == "balanced" and st["raw"] == 0.95 and st["asymmetry"] < 0.52


def test_hold_freezes_feedback_and_restarts_dwell():
    tr = BalanceTracker(BalanceConfig(**FAST))
    st, t = feed(tr, [0.6] * 25)
    assert st["recommendation"] == "train_left"
    st, t = feed(tr, [0.4] * 20, t, hold="motion")
    assert st["paused"] == "motion" and st["recommendation"] == "train_left"
    st, t = feed(tr, [0.4] * 5, t)                      # dwell starts only after the hold
    assert st["recommendation"] == "train_left" and st["pending"]["recommendation"] == "train_right"
    st, _ = feed(tr, [0.4] * 8, t)
    assert st["recommendation"] == "train_right"


def test_stats_and_streak():
    tr = BalanceTracker(BalanceConfig(**FAST))
    st, t = feed(tr, [0.5] * 31)                        # 1 s warmup + 2 s balanced
    st, t = feed(tr, [0.6] * 10, t)                     # 1 s right-dominant
    st, _ = feed(tr, [0.5] * 6, t)
    s = st["stats"]
    assert s["balanced_sec"] == pytest.approx(2.5, abs=0.15)
    assert s["right_dominant_sec"] == pytest.approx(1.0, abs=0.15)
    assert s["best_streak_sec"] == pytest.approx(2.0, abs=0.15)
    assert st["streak_sec"] == pytest.approx(0.5, abs=0.15)
    assert 60 < s["balanced_pct"] < 80
    tr.reset_stats()
    assert tr.state()["stats"]["session_sec"] == 0


def test_gap_restarts_warmup():
    tr = BalanceTracker(BalanceConfig(**FAST))
    st, t = feed(tr, [0.6] * 25)
    assert st["recommendation"] == "train_left"
    st, _ = feed(tr, [0.6], t + 5.0)                    # 5 s without data
    assert st["paused"] == "warming_up" and st["recommendation"] is None


def run_sim(sim, pipe, tracker, seconds, t):
    st = None
    for _ in range(int(seconds * 10)):                  # 10 Hz ticks, like fnirs_loop
        pipe.push(sim.generate(3))
        t += 3 / sim.fs
        st = tracker.update(pipe.metrics()["asymmetry"], t)
    return st, t


def test_simulated_lateralisation_drives_recommendation():
    sim, pipe = FNIRSSimulator(seed=7), FNIRSPipeline()
    tracker = BalanceTracker()
    st, t = run_sim(sim, pipe, tracker, 40, 0.0)        # baseline + warmup at rest
    sim.set_state("lateral_right")
    st, t = run_sim(sim, pipe, tracker, 40, t)
    assert st["zone"] == "right_dominant" and st["recommendation"] == "train_left"
    sim.set_state("lateral_left")
    st, _ = run_sim(sim, pipe, tracker, 60, t)
    assert st["zone"] == "left_dominant" and st["recommendation"] == "train_right"


def test_balance_api():
    pytest.importorskip("httpx")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import brainlink.fnirs_api as api

    api.fstate.balance = BalanceTracker()
    app = FastAPI()
    app.include_router(api.router)
    c = TestClient(app)
    assert c.get("/api/v1/fnirs/balance").json()["paused"] == "waiting"
    r = c.patch("/api/v1/fnirs/balance/config", json={"low": 0.45, "high": 0.55, "dwell_sec": 3})
    assert r.status_code == 200 and r.json()["config"]["low"] == 0.45
    assert c.patch("/api/v1/fnirs/balance/config", json={"low": 0.6}).status_code == 400
    assert c.patch("/api/v1/fnirs/balance/config", json={"nope": 1}).status_code == 400
    assert c.post("/api/v1/fnirs/balance/reset").json()["stats"]["session_sec"] == 0

    api.fstate.source = "simulator"
    api.fstate.simulator.generate_frames()              # start wall-clock pacing
    snap = api.fnirs_tick()
    assert snap["balance"]["paused"] in ("waiting", "warming_up")


def test_hold_breaks_the_streak():
    tr = BalanceTracker(BalanceConfig(**FAST))
    st, t = feed(tr, [0.5] * 40)
    assert st["streak_sec"] > 2
    st, t = feed(tr, [0.5] * 5, t, hold="motion")
    assert st["streak_sec"] == 0
    st, _ = feed(tr, [0.5] * 6, t)
    assert st["streak_sec"] == pytest.approx(0.5, abs=0.15)


def test_stalled_stream_holds_feedback(monkeypatch):
    import brainlink.fnirs_api as api

    clock = {"t": 1000.0}
    monkeypatch.setattr(api.time, "monotonic", lambda: clock["t"])
    sim = FNIRSSimulator(seed=3)
    batches = {"live": True}
    monkeypatch.setattr(api.fstate.simulator, "generate_frames",
                        lambda: sim.generate(3) if batches["live"] else [])
    api.fstate.source = "simulator"
    api.fstate.pipeline = FNIRSPipeline()
    api.fstate.balance = BalanceTracker(BalanceConfig(**FAST))
    api.fstate.last_frames_at = None
    for _ in range(200):                                # 20 s of live data
        clock["t"] += 0.1
        snap = api.fnirs_tick()
    assert snap["balance"]["paused"] is None
    session = snap["balance"]["stats"]["session_sec"]
    batches["live"] = False                             # stream stalls, last values stay put
    for _ in range(30):
        clock["t"] += 0.1
        snap = api.fnirs_tick()
    assert snap["balance"]["paused"] == "no_data"
    assert snap["balance"]["stats"]["session_sec"] <= session + 1.6
