"""
FastAPI router for the Mendi fNIRS integration.

Kept separate from the EEG routes so both modalities can run side by side
(e.g. HALO EEG + Mendi fNIRS at the same time).  Everything lives under
``/api/v1/fnirs``; the live stream is ``ws://…/api/v1/fnirs/stream``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import time
import traceback
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from .fnirs import EXTINCTION, FNIRSPipeline
from .fnirs_recorder import FNIRS_RECORDINGS_DIR, FNIRSRecorder
from .fnirs_simulator import FNIRS_SCENARIOS, FNIRS_STATES, FNIRSSimulator

try:
    from .mendi_ble import HAS_BLEAK, MendiBleAdapter
except ImportError:  # pragma: no cover
    HAS_BLEAK = False
    MendiBleAdapter = None  # type: ignore[assignment,misc]

log = logging.getLogger("brainlink.fnirs")

FNIRS_STREAM_HZ = 10


class FNIRSState:
    def __init__(self):
        self.pipeline = FNIRSPipeline()
        self.simulator = FNIRSSimulator()
        self.mendi: Optional["MendiBleAdapter"] = None
        self.source = "simulator"   # "simulator" | "device" | "off"
        self.recorder = FNIRSRecorder()
        self.ws_clients: list[WebSocket] = []
        self.running = False

    def device(self) -> Optional["MendiBleAdapter"]:
        if self.mendi is None and HAS_BLEAK:
            self.mendi = MendiBleAdapter()
        return self.mendi


fstate = FNIRSState()
router = APIRouter(prefix="/api/v1/fnirs", tags=["fNIRS (Mendi)"])


def _config() -> dict:
    return asdict(fstate.pipeline.config)


def _require_ble():
    if not HAS_BLEAK:
        raise HTTPException(501, "bleak is not installed — run: pip install bleak")


def _switch_source(name: str, force: bool = False):
    """Change source. A new signal, or a restarted stream, needs a new baseline."""
    if force or name != fstate.source:
        if name == "simulator" and fstate.pipeline.fs != fstate.simulator.fs:
            fstate.pipeline.set_rate(fstate.simulator.fs)  # device rate may have been adapted
        else:
            fstate.pipeline.reset()
        fstate.simulator.resync()
        if name == "device" and fstate.mendi is not None:
            fstate.mendi.drain()  # drop frames buffered while another source was active
    fstate.source = name


def _offset_ma(body: dict, key: str) -> float:
    try:
        v = float(body.get(key, 0))
    except (TypeError, ValueError):
        raise HTTPException(400, f"{key} must be a number") from None
    if not math.isfinite(v) or abs(v) > 127:
        raise HTTPException(400, f"{key} must be within ±127 mA")
    return v


# ─── Status / device ──────────────────────────────────────────────────

@router.get("/status")
async def fnirs_status():
    return {
        "ble_available": HAS_BLEAK,
        "source": fstate.source,
        "simulator": {"state": fstate.simulator.state, "auto": fstate.simulator.auto_progress},
        "device": _device_block(),
        "baseline_ready": fstate.pipeline.baseline_ready,
        "baseline_progress": fstate.pipeline.baseline_progress,
        "recording": fstate.recorder.info(),
        "config": _config(),
    }


@router.post("/device/scan")
async def fnirs_scan(timeout: float = 6.0):
    _require_ble()
    try:
        return {"devices": await asyncio.to_thread(fstate.device().scan, timeout)}
    except Exception as exc:
        raise HTTPException(500, f"Scan failed: {exc}") from exc


@router.post("/device/connect")
async def fnirs_connect(body: Optional[dict] = None):
    _require_ble()
    target = (body or {}).get("device") or (body or {}).get("device_name") or "Mendi"
    try:
        return await asyncio.to_thread(fstate.device().connect, target)
    except Exception as exc:
        raise HTTPException(500, f"Connection failed: {exc}") from exc


@router.post("/device/disconnect")
async def fnirs_disconnect():
    dev = fstate.mendi
    if dev and dev.is_connected:
        if fstate.source == "device":
            _switch_source("off")
        await asyncio.to_thread(dev.disconnect)
        return {"status": "disconnected", "source": fstate.source}
    return {"status": "not_connected"}


@router.post("/device/start-stream")
async def fnirs_start_stream():
    dev = fstate.mendi
    if not dev or not dev.is_connected:
        raise HTTPException(400, "No Mendi connected — call /api/v1/fnirs/device/connect first")
    try:
        await asyncio.to_thread(dev.start_stream)
    except Exception as exc:
        raise HTTPException(500, f"Failed to start stream: {exc}") from exc
    _switch_source("device", force=True)  # e.g. after a BLE drop the source is still "device"
    return {"status": "streaming", "source": "device"}


@router.post("/device/stop-stream")
async def fnirs_stop_stream():
    dev = fstate.mendi
    if dev and dev.is_streaming:
        await asyncio.to_thread(dev.stop_stream)
    if fstate.source == "device":
        _switch_source("off")
    return {"status": "stopped", "source": fstate.source}


@router.post("/device/calibration")
async def fnirs_calibration(body: dict):
    """Advanced: write LED offsets (mA, ±127) / auto-calibration / low-power mode."""
    offsets = [_offset_ma(body, k) for k in ("offset_l", "offset_r", "offset_p")]
    dev = fstate.mendi
    if not dev or not dev.is_connected:
        raise HTTPException(400, "No Mendi connected")
    try:
        await asyncio.to_thread(
            dev.set_calibration, *offsets,
            bool(body.get("auto", True)), bool(body.get("low_power", False)),
        )
    except Exception as exc:
        raise HTTPException(500, f"Calibration write failed: {exc}") from exc
    return {"ok": True}


@router.post("/source/{name}")
async def fnirs_set_source(name: str):
    if name not in ("simulator", "device", "off"):
        raise HTTPException(400, "source must be 'simulator', 'device' or 'off'")
    restarted = False
    if name == "device":
        dev = fstate.mendi
        if not dev or not dev.is_connected:
            raise HTTPException(400, "No Mendi connected")
        if not dev.is_streaming:
            try:
                await asyncio.to_thread(dev.start_stream)
            except Exception as exc:
                raise HTTPException(500, f"Failed to start stream: {exc}") from exc
            restarted = True
    _switch_source(name, force=restarted)
    return {"source": fstate.source}


# ─── Simulator ────────────────────────────────────────────────────────

@router.get("/simulator")
async def fnirs_sim_info():
    return {"states": FNIRS_STATES, "scenarios": FNIRS_SCENARIOS,
            "current": fstate.simulator.state, "auto": fstate.simulator.auto_progress}


@router.post("/simulator/{sim_state}")
async def fnirs_sim_set(sim_state: str):
    try:
        fstate.simulator.set_state(sim_state)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"state": fstate.simulator.state, "auto": fstate.simulator.auto_progress}


# ─── Pipeline ─────────────────────────────────────────────────────────

@router.post("/baseline/reset")
async def fnirs_baseline_reset():
    """Re-collect the I0 baseline (do this at rest after adjusting the band)."""
    fstate.pipeline.reset()
    return {"ok": True, "baseline_sec": fstate.pipeline.config.baseline_sec}


@router.get("/config")
async def fnirs_get_config():
    return {"config": _config(), "known_wavelengths_nm": sorted(EXTINCTION)}


@router.patch("/config")
async def fnirs_patch_config(body: dict):
    try:
        cfg = fstate.pipeline.set_config(**body)
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc
    fstate.simulator.cfg = cfg
    return {"config": _config(), "note": "baseline reset"}


@router.get("/snapshot")
async def fnirs_snapshot():
    return fstate.pipeline.snapshot()


# ─── Recording ────────────────────────────────────────────────────────

@router.post("/recording/start")
async def fnirs_rec_start(body: Optional[dict] = None):
    body = body or {}
    if fstate.recorder.recording:
        raise HTTPException(400, "Recording already in progress")
    name = str(body.get("name") or "").strip() or f"fnirs_{int(time.time())}"
    try:
        duration = max(10, min(7200, int(body.get("duration_sec", 600))))
    except (TypeError, ValueError, OverflowError):
        raise HTTPException(400, "duration_sec must be an integer") from None
    return fstate.recorder.start(name, duration, fstate.source, _config())


@router.post("/recording/stop")
async def fnirs_rec_stop():
    if not fstate.recorder.recording:
        raise HTTPException(400, "No recording in progress")
    return fstate.recorder.stop()


@router.post("/marker")
async def fnirs_marker(body: dict):
    label = str(body.get("label", "")).strip()
    if not label:
        raise HTTPException(400, "label is required")
    marker = fstate.recorder.mark(label[:64])
    if marker is None:
        raise HTTPException(400, "No recording in progress — markers are stored in recordings")
    return marker


@router.get("/recordings")
async def fnirs_recordings():
    recs = []
    if FNIRS_RECORDINGS_DIR.exists():
        for p in sorted(FNIRS_RECORDINGS_DIR.glob("*_meta.json"), reverse=True):
            try:
                with open(p) as f:
                    recs.append(json.load(f))
            except (OSError, json.JSONDecodeError) as exc:
                log.warning("Skipping unreadable fNIRS meta %s: %s", p.name, exc)
    return {"recordings": recs}


@router.get("/recordings/{session_id}/csv")
async def fnirs_recording_csv(session_id: str):
    if not session_id.isalnum():
        raise HTTPException(400, "Invalid session id")
    path = FNIRS_RECORDINGS_DIR / f"{session_id}_fnirs.csv"
    if not path.exists():
        raise HTTPException(404, "Recording not found")
    return FileResponse(path, media_type="text/csv", filename=f"{session_id}_fnirs.csv")


# ─── WebSocket + background loop ──────────────────────────────────────

@router.websocket("/stream")
async def fnirs_ws(ws: WebSocket):
    await ws.accept()
    fstate.ws_clients.append(ws)
    try:
        while True:
            msg = await ws.receive_text()
            try:
                cmd = json.loads(msg)
            except json.JSONDecodeError:
                continue
            if cmd.get("action") == "marker" and cmd.get("label"):
                fstate.recorder.mark(str(cmd["label"])[:64])
            elif cmd.get("action") == "set_state":
                try:
                    fstate.simulator.set_state(cmd.get("state", "rest"))
                except ValueError:
                    pass
    except (WebSocketDisconnect, Exception):
        if ws in fstate.ws_clients:
            fstate.ws_clients.remove(ws)


def fnirs_tick() -> Optional[dict]:
    """One processing cycle. Returns the frame to broadcast (or None)."""
    if fstate.recorder.stop_if_expired():
        log.info("fNIRS recording auto-stopped (duration reached)")
    if fstate.source == "off":
        return {"ts": int(time.time() * 1000), "source": "off",
                "device": _device_block(), "recording": fstate.recorder.info()}
    if fstate.source == "device":
        dev = fstate.mendi
        frames = dev.drain() if dev and dev.is_streaming else []
    else:
        frames = fstate.simulator.generate_frames()

    derived = fstate.pipeline.push(frames)
    if fstate.source == "device" and fstate.pipeline.adapt_rate():
        log.info("fNIRS sample rate set to measured %.1f Hz (baseline restarted)", fstate.pipeline.fs)
    if frames and fstate.recorder.recording:
        fstate.recorder.add(frames, derived)

    snap = fstate.pipeline.snapshot()
    snap.update({
        "source": fstate.source,
        "device": _device_block(),
        "simulator": ({"state": fstate.simulator.state, "auto": fstate.simulator.auto_progress}
                      if fstate.source == "simulator" else None),
        "recording": fstate.recorder.info(),
        "frames_this_tick": len(frames),
    })
    return snap


def _device_block() -> dict:
    dev = fstate.mendi
    if dev and dev.is_connected:
        return {**dev.device_info, "connected": True, "streaming": dev.is_streaming}
    return {"connected": False, "streaming": False}


async def fnirs_loop():
    fstate.running = True
    interval = 1.0 / FNIRS_STREAM_HZ
    while fstate.running:
        t0 = time.time()
        try:
            frame = fnirs_tick()
            if frame is not None and fstate.ws_clients:
                payload = json.dumps(frame, default=_json_default)
                dead = []
                for ws in fstate.ws_clients:
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    if ws in fstate.ws_clients:
                        fstate.ws_clients.remove(ws)
        except Exception:
            traceback.print_exc()
            await asyncio.sleep(1.0)
        await asyncio.sleep(max(0.0, interval - (time.time() - t0)))


def fnirs_shutdown():
    """Stop the loop, close any open recording and release the Mendi."""
    fstate.running = False
    if fstate.recorder.recording:
        fstate.recorder.stop()
    if fstate.mendi is not None:
        try:
            fstate.mendi.close()
        except Exception:
            log.exception("Error while closing the Mendi adapter")


def _json_default(o):
    try:
        import numpy as np
        if isinstance(o, np.generic):
            return o.item()
    except ImportError:
        pass
    return str(o)
