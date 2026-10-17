"""
Hemispheric balance tracker for the fNIRS trainer view.

Turns the pipeline's per-tick ``asymmetry`` (0–1; 0.5 = balanced, < 0.5 = left
prefrontal cortex more oxygenated, > 0.5 = right) into a stable recommendation:

* ``train_left``  — right side dominates → suggest left-hemisphere tasks
* ``train_right`` — left side dominates  → suggest right-hemisphere tasks
* ``focus``       — inside the balance band → hold attention on the forehead

Raw asymmetry is noisy (Mayer waves, respiration, a metric that is still
settling right after the baseline), so it is smoothed with an exponential
moving average, classified with hysteresis, and the recommendation only
changes once the new zone has persisted for ``dwell_sec``.  Feedback is held
while the signal is unreliable (motion, poor optode contact): neurofeedback on
artefacts would reward the wrong thing.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Optional

ZONES = ("left_dominant", "balanced", "right_dominant")
RECOMMENDATION = {"left_dominant": "train_right", "balanced": "focus", "right_dominant": "train_left"}
MAX_GAP_SEC = 2.0   # a longer gap between updates (source switch, stalled stream) starts over


@dataclass
class BalanceConfig:
    low: float = 0.47            # balanced band, lower edge (asymmetry)
    high: float = 0.53           # balanced band, upper edge
    hysteresis: float = 0.01     # extra margin before leaving the balanced band
    smoothing_sec: float = 4.0   # EMA time constant; 0 = no smoothing
    dwell_sec: float = 5.0       # a zone must persist this long to change the recommendation
    warmup_sec: float = 15.0     # ignored after (re)start while the asymmetry metric settles

    def validate(self):
        for k, v in asdict(self).items():
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
                raise ValueError(f"{k} must be a finite number")
        if not 0.0 < self.low < self.high < 1.0:
            raise ValueError("need 0 < low < high < 1")
        if not 0.0 <= self.hysteresis <= 0.1:
            raise ValueError("hysteresis must be within 0..0.1")
        for k in ("smoothing_sec", "dwell_sec", "warmup_sec"):
            if not 0.0 <= getattr(self, k) <= 600.0:
                raise ValueError(f"{k} must be within 0..600 s")


class BalanceTracker:
    """Call :meth:`update` once per stream tick; it returns the state for the UI / WebSocket."""

    def __init__(self, config: Optional[BalanceConfig] = None):
        self.config = config or BalanceConfig()
        self.config.validate()
        self.reset_stats()
        self._restart()
        self.paused: Optional[str] = "waiting"

    # ── Lifecycle ──────────────────────────────────────────────────
    def _restart(self):
        """Forget the signal state (gap, new baseline, …). Session stats are kept."""
        self.raw: Optional[float] = None
        self.smoothed: Optional[float] = None
        self.zone: Optional[str] = None
        self.recommendation: Optional[str] = None
        self._now: Optional[float] = None
        self._t_last: Optional[float] = None
        self._valid_since: Optional[float] = None
        self._rec_zone: Optional[str] = None
        self._rec_since: Optional[float] = None
        self._candidate: Optional[str] = None
        self._candidate_since: Optional[float] = None
        self._active_last = False
        self.streak_sec = 0.0

    def reset_stats(self):
        self.zone_sec = {z: 0.0 for z in ZONES}
        self.session_sec = 0.0
        self.streak_sec = 0.0
        self.best_streak_sec = 0.0

    def set_config(self, **overrides) -> BalanceConfig:
        cfg = BalanceConfig(**{**asdict(self.config), **overrides})
        cfg.validate()
        self.config = cfg
        return cfg

    # ── Update ─────────────────────────────────────────────────────
    def update(self, asymmetry: Optional[float], now: float, hold: Optional[str] = None) -> dict:
        """
        Feed one asymmetry sample (``None`` while the pipeline has no baseline).
        ``now`` is a monotonic time in seconds; ``hold`` names a reason to freeze
        feedback (e.g. ``"motion"``, ``"poor_signal"``).
        """
        if asymmetry is None or not math.isfinite(asymmetry):
            self._restart()
            self.paused = "waiting"
            return self.state()
        if self._t_last is not None and now - self._t_last > MAX_GAP_SEC:
            self._restart()
        dt = 0.0 if self._t_last is None else max(0.0, now - self._t_last)
        self._t_last = self._now = now
        self.raw = asymmetry
        if self.smoothed is None or self.config.smoothing_sec <= 0:
            self.smoothed = asymmetry
        else:
            self.smoothed += (1.0 - math.exp(-dt / self.config.smoothing_sec)) * (asymmetry - self.smoothed)
        if self._valid_since is None:
            self._valid_since = now

        if hold or now - self._valid_since < self.config.warmup_sec:
            # Freeze zone and recommendation; a new zone must persist the full dwell afterwards
            self.paused = hold or "warming_up"
            self._candidate = None
            self._active_last = False
            self.streak_sec = 0.0  # unmeasured time breaks the streak
            return self.state()

        self.paused = None
        self.zone = self._classify(self.smoothed)
        if self._active_last:  # only count time between two active ticks
            self.session_sec += dt
            self.zone_sec[self.zone] += dt
            if self.zone == "balanced":
                self.streak_sec += dt
                self.best_streak_sec = max(self.best_streak_sec, self.streak_sec)
        if self.zone != "balanced":
            self.streak_sec = 0.0
        self._active_last = True

        if self.zone == self._rec_zone:
            self._candidate = None
        else:
            if self._candidate != self.zone:
                self._candidate, self._candidate_since = self.zone, now
            if now - self._candidate_since >= self.config.dwell_sec:
                self._rec_zone, self._rec_since = self.zone, now
                self.recommendation = RECOMMENDATION[self.zone]
                self._candidate = None
        return self.state()

    def _classify(self, a: float) -> str:
        c = self.config
        margin = c.hysteresis if self.zone == "balanced" else 0.0  # enter at the band, leave past the margin
        if c.low - margin <= a <= c.high + margin:
            return "balanced"
        return "left_dominant" if a < (c.low + c.high) / 2.0 else "right_dominant"

    # ── Output ─────────────────────────────────────────────────────
    def state(self) -> dict:
        now = self._now
        warm_left = None
        if self.paused == "warming_up" and now is not None and self._valid_since is not None:
            warm_left = round(max(0.0, self.config.warmup_sec - (now - self._valid_since)), 1)
        pending = None
        if self._candidate is not None and now is not None and self._candidate_since is not None:
            pending = {"zone": self._candidate,
                       "recommendation": RECOMMENDATION[self._candidate],
                       "in_sec": round(max(0.0, self.config.dwell_sec - (now - self._candidate_since)), 1)}
        s = self.session_sec
        return {
            "asymmetry": None if self.smoothed is None else round(self.smoothed, 3),
            "raw": None if self.raw is None else round(self.raw, 3),
            "zone": self.zone,
            "recommendation": self.recommendation,
            "recommendation_sec": (round(now - self._rec_since, 1)
                                   if self.recommendation and now is not None else None),
            "pending": pending,
            "paused": self.paused,
            "warmup_left_sec": warm_left,
            "streak_sec": round(self.streak_sec, 1),
            "stats": {
                "session_sec": round(s, 1),
                "balanced_sec": round(self.zone_sec["balanced"], 1),
                "left_dominant_sec": round(self.zone_sec["left_dominant"], 1),
                "right_dominant_sec": round(self.zone_sec["right_dominant"], 1),
                "balanced_pct": round(100.0 * self.zone_sec["balanced"] / s, 1) if s > 0 else None,
                "best_streak_sec": round(self.best_streak_sec, 1),
            },
            "config": asdict(self.config),
        }
