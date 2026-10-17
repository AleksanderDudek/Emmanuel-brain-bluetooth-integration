"""
Mendi fNIRS simulator.

Produces raw :class:`~brainlink.mendi_proto.Frame` objects that look like
what the headband streams: ambient-contaminated IR/red intensities whose
optical density follows a synthetic haemodynamic model, plus cardiac pulse,
respiration, Mayer waves, noise and IMU readings.

The forward model is the inverse of the pipeline's modified Beer–Lambert law,
so ΔHbO/ΔHbR recovered by :class:`~brainlink.fnirs.FNIRSPipeline` should
track the simulated values — useful as an end-to-end test.
"""

from __future__ import annotations

import math
import time
from typing import Optional

import numpy as np

from .fnirs import EXTINCTION, FNIRSConfig, MENDI_SAMPLE_RATE
from .mendi_proto import Frame

# Target ΔHbO / ΔHbR (µM) and extras per state
FNIRS_STATES: dict[str, dict] = {
    "rest":         {"hbo": 0.0,  "hbr": 0.0,   "hr": 68, "motion": 0.0, "contact": 1.0},
    "task":         {"hbo": 0.6,  "hbr": -0.2,  "hr": 78, "motion": 0.0, "contact": 1.0},
    "high_load":    {"hbo": 1.1,  "hbr": -0.35, "hr": 88, "motion": 0.0, "contact": 1.0},
    "relax":        {"hbo": -0.3, "hbr": 0.1,   "hr": 62, "motion": 0.0, "contact": 1.0},
    "motion":       {"hbo": 0.0,  "hbr": 0.0,   "hr": 75, "motion": 1.0, "contact": 1.0},
    "poor_contact": {"hbo": 0.0,  "hbr": 0.0,   "hr": 70, "motion": 0.0, "contact": 0.15},
}

# Block designs: list of (state, seconds)
FNIRS_SCENARIOS: dict[str, list[tuple[str, int]]] = {
    "block_design": [("rest", 20), ("task", 20)] * 4 + [("rest", 20)],
    "n_back":       [("rest", 30), ("task", 30), ("rest", 30), ("high_load", 30), ("rest", 30)],
    "meditation":   [("rest", 30), ("relax", 90), ("rest", 30)],
}


class FNIRSSimulator:
    """Generate Mendi-like frames in real time (``generate_frames``)."""

    def __init__(self, fs: float = MENDI_SAMPLE_RATE, config: Optional[FNIRSConfig] = None,
                 seed: Optional[int] = None):
        self.fs = fs
        self.cfg = config or FNIRSConfig()
        self.rng = np.random.default_rng(seed)
        self.t = 0.0
        self.state = "rest"
        self.auto_mode = False
        self._scenario: list[tuple[str, int]] = []
        self._scenario_name: Optional[str] = None
        self._scenario_t0 = 0.0
        self._wall_last: Optional[float] = None
        self._frac = 0.0
        # Smoothed (haemodynamically lagged) values per side
        self._hbo = {"l": 0.0, "r": 0.0}
        self._hbr = {"l": 0.0, "r": 0.0}
        self._contact = 1.0
        self._hr = 68.0
        self._cardiac_phase = 0.0
        self.base_ir = {"l": 52_000.0, "r": 49_000.0, "p": 61_000.0}
        self.base_red = {"l": 31_000.0, "r": 29_500.0, "p": 38_000.0}
        self.base_amb = {"l": 900.0, "r": 950.0, "p": 700.0}
        self._ln10 = math.log(10)

    # ── Control ────────────────────────────────────────────────────
    def set_state(self, state: str):
        if state.startswith("auto:"):
            name = state[5:]
            if name not in FNIRS_SCENARIOS:
                raise ValueError(f"Unknown scenario '{name}'")
            self._scenario = FNIRS_SCENARIOS[name]
            self._scenario_name = name
            self._scenario_t0 = self.t
            self.auto_mode = True
            self.state = self._scenario[0][0]
            return
        if state == "auto_stop":
            self.auto_mode = False
            self._scenario_name = None
            self.state = "rest"
            return
        if state not in FNIRS_STATES:
            raise ValueError(f"Unknown state '{state}'")
        self.auto_mode = False
        self._scenario_name = None
        self.state = state

    @property
    def auto_progress(self) -> Optional[dict]:
        if not self.auto_mode:
            return None
        total = sum(d for _, d in self._scenario)
        elapsed = (self.t - self._scenario_t0) % total
        return {"scenario": self._scenario_name, "elapsed_sec": round(elapsed, 1),
                "total_sec": total, "state": self.state}

    def _update_auto(self):
        total = sum(d for _, d in self._scenario)
        elapsed = (self.t - self._scenario_t0) % total
        acc = 0
        for st, d in self._scenario:
            acc += d
            if elapsed < acc:
                self.state = st
                return

    # ── Generation ─────────────────────────────────────────────────
    def resync(self):
        """Restart wall-clock pacing (e.g. after the simulator was not polled for a while)."""
        self._wall_last = None
        self._frac = 0.0

    def generate_frames(self) -> list[Frame]:
        """Return the frames that 'arrived' since the last call (wall-clock paced)."""
        now = time.monotonic()
        if self._wall_last is None:
            self._wall_last = now
            return []
        exact = (now - self._wall_last) * self.fs + self._frac
        n = int(exact)
        self._frac = exact - n
        self._wall_last = now
        return self.generate(min(n, int(self.fs * 2)))

    def generate(self, n: int) -> list[Frame]:
        frames = []
        dt = 1.0 / self.fs
        e_red = EXTINCTION[self.cfg.red_nm]
        e_ir = EXTINCTION[self.cfg.ir_nm]
        L_red = self.cfg.separation_cm * self.cfg.dpf_red
        L_ir = self.cfg.separation_cm * self.cfg.dpf_ir
        # ~5 s time constant approximates the slow haemodynamic response
        alpha = 1.0 - math.exp(-dt / 5.0)
        # Spread the batch over the frame period so timestamps stay increasing
        wall0 = time.time() - (n - 1) * dt
        for i in range(n):
            if self.auto_mode:
                self._update_auto()
            tgt = FNIRS_STATES[self.state]
            for side, gain in (("l", 0.9), ("r", 1.1)):  # slight lateralisation
                self._hbo[side] += alpha * (tgt["hbo"] * gain - self._hbo[side])
                self._hbr[side] += alpha * (tgt["hbr"] * gain - self._hbr[side])
            self._contact += 0.05 * (tgt["contact"] - self._contact)
            self._hr += 0.02 * (tgt["hr"] - self._hr)
            self._cardiac_phase += 2 * math.pi * (self._hr / 60.0) * dt

            t = self.t
            # Physiological oscillations (µM): Mayer ~0.1 Hz, respiration ~0.25 Hz
            mayer = 0.12 * math.sin(2 * math.pi * 0.1 * t)
            resp = 0.05 * math.sin(2 * math.pi * 0.25 * t + 0.7)
            # Cardiac: sharp-ish systolic upstroke
            c = math.sin(self._cardiac_phase)
            cardiac = 0.25 * (max(c, 0.0) ** 3 - 0.3 * max(-c, 0.0))

            motion_amp = tgt["motion"]
            spike = motion_amp * (self.rng.normal(0, 1.0) + 3.0 * math.sin(2 * math.pi * 0.7 * t))

            vals = {}
            for side in ("l", "r", "p"):
                if side == "p":
                    hbo = 0.5 * (self._hbo["l"] + self._hbo["r"])
                    hbr = 0.5 * (self._hbr["l"] + self._hbr["r"])
                    card = cardiac * 3.0
                else:
                    hbo, hbr = self._hbo[side], self._hbr[side]
                    card = cardiac
                hbo_t = hbo + mayer + resp + card + spike * 0.4
                hbr_t = hbr - 0.3 * mayer + 0.2 * card + spike * 0.1
                od_red = (e_red[0] * hbo_t + e_red[1] * hbr_t) * 1e-6 * L_red
                od_ir = (e_ir[0] * hbo_t + e_ir[1] * hbr_t) * 1e-6 * L_ir
                amb = self.base_amb[side] * (1.0 + 0.05 * math.sin(2 * math.pi * 0.03 * t))
                contact = self._contact
                leak = (1.0 - contact) * 20_000.0
                ir = self.base_ir[side] * contact * 10 ** (-od_ir)
                red = self.base_red[side] * contact * 10 ** (-od_red)
                noise = self.rng.normal(0, 8.0, 3)
                vals[side] = (
                    int(ir + amb + leak + noise[0]),
                    int(red + amb + leak + noise[1]),
                    int(amb + leak + noise[2]),
                )

            g = 16384  # 1 g on a ±2 g int16 scale
            acc = (
                int(self.rng.normal(0, 80) + spike * 1500),
                int(self.rng.normal(0, 80) + spike * 900),
                int(g + self.rng.normal(0, 80)),
            )
            gyro = tuple(int(self.rng.normal(0, 40) + spike * 9000) for _ in range(3))
            frames.append(Frame(
                acc_x=acc[0], acc_y=acc[1], acc_z=acc[2],
                ang_x=gyro[0], ang_y=gyro[1], ang_z=gyro[2],
                temp=33.5 + 0.2 * math.sin(2 * math.pi * t / 300.0),
                ir_l=vals["l"][0], red_l=vals["l"][1], amb_l=vals["l"][2],
                ir_r=vals["r"][0], red_r=vals["r"][1], amb_r=vals["r"][2],
                ir_p=vals["p"][0], red_p=vals["p"][1], amb_p=vals["p"][2],
                timestamp=wall0 + i * dt,
            ))
            self.t += dt
        return frames

    @property
    def truth(self) -> dict:
        """Current underlying (noise-free, slow) ΔHbO/ΔHbR — handy for tests."""
        return {"hbo": dict(self._hbo), "hbr": dict(self._hbr)}
