"""fNIRS session recorder: raw Mendi frames + derived ΔHbO/ΔHbR + event markers → CSV."""

from __future__ import annotations

import csv
import json
import os
import threading
import time
import uuid
from typing import Optional

import numpy as np

from .constants import RECORDINGS_DIR
from .mendi_proto import Frame

FNIRS_RECORDINGS_DIR = RECORDINGS_DIR / "fnirs"

RAW_FIELDS = [
    "ir_l", "red_l", "amb_l", "ir_r", "red_r", "amb_r", "ir_p", "red_p", "amb_p",
    "acc_x", "acc_y", "acc_z", "ang_x", "ang_y", "ang_z", "temp",
]
DERIVED_FIELDS = ["hbo_left", "hbr_left", "hbo_right", "hbr_right"]
CSV_HEADER = ["timestamp", "sample_idx"] + RAW_FIELDS + DERIVED_FIELDS + ["marker"]


class FNIRSRecorder:
    """
    Output per session in ``recordings/fnirs/``:

    - ``<id>_fnirs.csv`` — one row per frame (raw + derived + marker)
    - ``<id>_meta.json`` — name, duration, pipeline config, marker list, …
    """

    def __init__(self):
        self.recording = False
        self.session_id: Optional[str] = None
        self.name = ""
        self.duration_sec = 300
        self.start_time = 0.0
        self.notes = ""
        self.source = "unknown"
        self.config: dict = {}
        self.markers: list[dict] = []
        self._pending_marker: Optional[str] = None
        self._file = None
        self._writer = None
        self._count = 0
        self._lock = threading.Lock()

    def start(self, name: str, duration_sec: int, source: str, config: dict) -> dict:
        if self.recording:
            raise RuntimeError("Already recording")
        FNIRS_RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
        self.session_id = uuid.uuid4().hex[:12]
        self.name, self.duration_sec, self.source, self.config = name, duration_sec, source, config
        self.start_time = time.time()
        self.notes, self.markers, self._pending_marker, self._count = "", [], None, 0
        self._file = open(FNIRS_RECORDINGS_DIR / f"{self.session_id}_fnirs.csv", "w", newline="")
        self._writer = csv.writer(self._file)
        self._writer.writerow(CSV_HEADER)
        self.recording = True
        self._save_meta()
        return self.info()

    def mark(self, label: str) -> Optional[dict]:
        """
        Attach an event label to the next recorded frame (e.g. 'task_start').
        Returns ``None`` when no recording is in progress.  Labels that arrive
        before the next frame are joined with ``|`` so none are lost.
        """
        if not self.recording:
            return None
        now = time.time()
        m = {"label": label, "time": now, "t_sec": round(now - self.start_time, 3)}
        with self._lock:
            self._pending_marker = f"{self._pending_marker}|{label}" if self._pending_marker else label
            self.markers.append(m)
        return m

    def stop_if_expired(self) -> bool:
        """Stop the session once its duration is reached. Returns True if it stopped."""
        if self.recording and time.time() - self.start_time >= self.duration_sec:
            self.stop()
            return True
        return False

    def add(self, frames: list[Frame], derived: dict[str, np.ndarray]) -> bool:
        """Append frames. Returns True if auto-stopped because duration was reached."""
        if not self.recording or self._writer is None:
            return False
        if self.stop_if_expired():
            return True
        with self._lock:
            for i, f in enumerate(frames):
                row = [round(f.timestamp or time.time(), 4), self._count]
                row += [round(getattr(f, k), 3) if k == "temp" else getattr(f, k) for k in RAW_FIELDS]
                for k in DERIVED_FIELDS:
                    v = derived.get(k)
                    row.append("" if v is None or i >= len(v) or np.isnan(v[i]) else round(float(v[i]), 5))
                row.append(self._pending_marker or "")
                self._pending_marker = None
                self._writer.writerow(row)
                self._count += 1
            self._file.flush()
        return False

    def stop(self) -> dict:
        info = self.info()
        self.recording = False
        if self._file:
            self._file.close()
            self._file = None
            self._writer = None
        self._save_meta()
        info["recording"] = False
        return info

    def info(self) -> dict:
        elapsed = time.time() - self.start_time if self.recording else 0.0
        return {
            "session_id": self.session_id,
            "name": self.name,
            "recording": self.recording,
            "duration_sec": self.duration_sec,
            "elapsed_sec": round(elapsed, 1),
            "remaining_sec": round(max(0.0, self.duration_sec - elapsed), 1),
            "sample_count": self._count,
            "markers": len(self.markers),
        }

    def _save_meta(self):
        if not self.session_id:
            return
        meta = {
            "session_id": self.session_id,
            "modality": "fnirs",
            "device": "Mendi",
            "name": self.name,
            "source": self.source,
            "duration_sec": self.duration_sec,
            "start_time": self.start_time,
            "end_time": None if self.recording else time.time(),
            "sample_count": self._count,
            "columns": CSV_HEADER,
            "pipeline_config": self.config,
            "markers": self.markers,
            "notes": self.notes,
        }
        # Write-then-rename so a concurrent listing never sees a half-written file
        path = FNIRS_RECORDINGS_DIR / f"{self.session_id}_meta.json"
        tmp = path.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(meta, f, indent=2)
        os.replace(tmp, path)
