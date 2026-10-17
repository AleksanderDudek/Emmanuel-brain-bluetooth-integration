"""
BLE adapter for the Mendi fNIRS headband (macOS / Windows / Linux via bleak).

Protocol details come from the open-source, reverse-engineered Rust client
https://github.com/eugenehp/mendi (MIT).  Mendi does **not** provide an
official SDK; this may break with a firmware update.

GATT layout (vendor base ``fc3eXXXX-c6c4-49e6-922a-6e551c455af5``)::

    ABB0  service
    ABB1  Frame        notify  IMU + temperature + 3 optical channels
    ABB2  Sensor       write/notify  optical-sensor registers (also enable/disable)
    ABB3  IMU          write/notify  IMU registers
    ABB4  ADC          notify  battery voltage / charging / USB
    ABB5  Diagnostics  read    power-on self-test
    ABB6  Calibration  write/notify  LED offsets, auto-cal, low-power mode
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import deque
from typing import Optional

try:
    from bleak import BleakClient, BleakScanner
    HAS_BLEAK = True
except ImportError:  # pragma: no cover
    HAS_BLEAK = False

from .fnirs import MENDI_SAMPLE_RATE
from .mendi_proto import (
    Calibration,
    Frame,
    Sensor,
    SENSOR_DISABLE_PAYLOAD,
    SENSOR_ENABLE_PAYLOAD,
    decode_adc,
    decode_calibration,
    decode_diagnostics,
    decode_frame,
    decode_sensor,
)

log = logging.getLogger("brainlink.mendi")


def mendi_uuid(short: int) -> str:
    return f"fc3e{short:04x}-c6c4-49e6-922a-6e551c455af5"


SVC_MENDI = mendi_uuid(0xABB0)
CHR_FRAME = mendi_uuid(0xABB1)
CHR_SENSOR = mendi_uuid(0xABB2)
CHR_IMU = mendi_uuid(0xABB3)
CHR_ADC = mendi_uuid(0xABB4)
CHR_DIAGNOSTICS = mendi_uuid(0xABB5)
CHR_CALIBRATION = mendi_uuid(0xABB6)
CHR_FIRMWARE_REV = "00002a26-0000-1000-8000-00805f9b34fb"
CHR_HARDWARE_REV = "00002a27-0000-1000-8000-00805f9b34fb"

MENDI_NAME_PREFIX = "Mendi"
MENDI_FCC_ID = "RYYEYSHJN"

# Optical front-end registers (layout matches a TI AFE4404).  Firmware 1.0.1 /
# hardware r2.1b leaves the timing engine off, so no conversions happen and no
# Frame notifications are sent until TIMEREN is set.  Found by reading the
# registers over ABB2; not part of the upstream client.
AFE_CONTROL1 = 0x1E
AFE_TIMEREN = 0x000100


class MendiBleAdapter:
    """
    Thread-safe wrapper around a bleak connection to a Mendi headband.

    Workflow::

        m = MendiBleAdapter()
        m.scan()                 # [{'name': 'Mendi-XXXX', 'address': ...}]
        m.connect("Mendi")       # name substring or address
        m.start_stream()
        frames = m.drain()       # list[Frame] received since last call
        m.stop_stream(); m.disconnect()
    """

    def __init__(self, buffer_sec: float = 10.0):
        if not HAS_BLEAK:
            raise RuntimeError("bleak is not installed. Run: pip install bleak")
        self._client: Optional[BleakClient] = None
        self._connected = False
        self._streaming = False
        self._address: Optional[str] = None
        self._name: Optional[str] = None
        self._firmware = "unknown"
        self._hardware = "unknown"
        self._lock = threading.Lock()       # frame buffer (BLE thread vs. drain)
        # Serialises scan/connect/stream/disconnect: API handlers call these via
        # asyncio.to_thread, so a double-clicked "connect" would otherwise race.
        self._op_lock = threading.RLock()
        self._frames: deque[Frame] = deque(maxlen=int(buffer_sec * MENDI_SAMPLE_RATE * 2))
        self._dropped = 0
        self._invalid = 0
        self.battery: Optional[dict] = None
        self.calibration: Optional[dict] = None
        self.diagnostics: Optional[dict] = None
        self.last_sensor_read: Optional[dict] = None
        self._last_frame_time: Optional[float] = None
        self._frame_total = 0
        self._sensor_reply: Optional[asyncio.Future] = None
        self._sensor_reply_addr = -1
        self._afe_restore: Optional[int] = None   # CONTROL1 value to put back on stop
        self.sensor_woken = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None

    # ── async plumbing (same pattern as HALOBleAdapter) ────────────
    def _ensure_loop(self):
        with self._op_lock:
            # is_running() can still be False right after Thread.start(); is_closed() cannot race
            if self._loop is not None and not self._loop.is_closed():
                return
            self._loop = asyncio.new_event_loop()
            self._thread = threading.Thread(target=self._loop.run_forever, daemon=True,
                                            name="mendi-ble")
            self._thread.start()

    def _run(self, coro, timeout: float = 30):
        self._ensure_loop()
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout=timeout)

    # ── Scanning ───────────────────────────────────────────────────
    def scan(self, timeout: float = 6.0) -> list[dict]:
        with self._op_lock:
            return self._run(self._async_scan(timeout), timeout=timeout + 10)

    async def _async_scan(self, timeout: float) -> list[dict]:
        found = await BleakScanner.discover(timeout=timeout, return_adv=True)
        out = []
        for _addr, (dev, adv) in found.items():
            name = dev.name or adv.local_name or ""
            uuids = [u.lower() for u in (adv.service_uuids or [])]
            if name.startswith(MENDI_NAME_PREFIX) or SVC_MENDI in uuids:
                out.append({"name": name or "Mendi", "address": dev.address, "rssi": adv.rssi})
        return out

    # ── Connection ─────────────────────────────────────────────────
    def connect(self, address_or_name: str = MENDI_NAME_PREFIX) -> dict:
        with self._op_lock:
            return self._run(self._async_connect(address_or_name), timeout=45)

    async def _async_connect(self, target: str) -> dict:
        if self.is_connected:
            # A second BleakClient would orphan the first and keep the band busy
            return {"status": "already_connected", **self.device_info}
        address = target
        if not self._looks_like_address(target):
            devices = await self._async_scan(8.0)
            match = next((d for d in devices if target.lower() in d["name"].lower()), None)
            if not match:
                raise RuntimeError(
                    f"Mendi '{target}' not found. Make sure it is charged, switched on, "
                    "and not connected to the Mendi phone app."
                )
            address, self._name = match["address"], match["name"]

        self._client = BleakClient(address, disconnected_callback=self._on_disconnect)
        await asyncio.wait_for(self._client.connect(), timeout=15)
        self._connected = True
        self._address = address

        for uuid, attr in ((CHR_FIRMWARE_REV, "_firmware"), (CHR_HARDWARE_REV, "_hardware")):
            try:
                val = await self._client.read_gatt_char(uuid)
                setattr(self, attr, val.decode("utf-8", errors="replace").strip("\x00"))
            except Exception:
                pass

        if not self._name:
            self._name = getattr(self._client, "name", None) or MENDI_NAME_PREFIX

        # Status characteristics are useful even before streaming.  Firmware 1.0.1
        # pushes Diagnostics as a notification (read → "Read Not Permitted"), while
        # upstream documents a read, so subscribe and also try the read.
        for uuid, cb in ((CHR_ADC, self._on_adc), (CHR_CALIBRATION, self._on_calibration),
                         (CHR_SENSOR, self._on_sensor), (CHR_DIAGNOSTICS, self._on_diagnostics)):
            try:
                await self._client.start_notify(uuid, cb)
            except Exception as exc:
                log.debug("Could not subscribe to %s: %s", uuid, exc)
        try:
            self._on_diagnostics(None, await self._client.read_gatt_char(CHR_DIAGNOSTICS))
        except Exception as exc:
            log.debug("Diagnostics read failed: %s", exc)

        log.info("Connected to %s (%s)", self._name or address, address)
        return {"status": "connected", **self.device_info}

    def _on_disconnect(self, _client):
        log.warning("Mendi disconnected")
        self._connected = False
        self._streaming = False

    def disconnect(self):
        with self._op_lock:
            if self._streaming:
                self.stop_stream()
            if self._client is not None:
                try:
                    self._run(self._client.disconnect(), timeout=10)
                except Exception as exc:
                    log.warning("Mendi disconnect failed: %s", exc)
            self._connected = False
            self._client = None
            self._address = None
            self._name = None

    # ── Streaming ──────────────────────────────────────────────────
    def start_stream(self):
        with self._op_lock:
            if not self.is_connected:
                raise RuntimeError("Not connected")
            self._run(self._async_start_stream())
            self._streaming = True

    async def _async_start_stream(self):
        with self._lock:
            self._frames.clear()
        await self._client.start_notify(CHR_FRAME, self._on_frame)
        # What the Mendi app sends (per upstream); on the wire it is a read of register 0
        try:
            await self._client.write_gatt_char(CHR_SENSOR, SENSOR_ENABLE_PAYLOAD, response=True)
        except Exception as exc:
            log.warning("Sensor enable write failed (may be harmless): %s", exc)
        await self._async_wake_sensor()
        log.info("Mendi stream started")

    async def _async_wake_sensor(self, grace_sec: float = 1.0):
        """Start the optical front-end if the firmware left it idle (see AFE_CONTROL1)."""
        n0 = self._frame_total
        await asyncio.sleep(grace_sec)
        if self._frame_total - n0 >= 5:
            return  # firmware streams on its own; leave its registers alone
        ctrl1 = await self._async_read_sensor_reg(AFE_CONTROL1)
        if ctrl1 is None:
            log.warning("No frames and CONTROL1 unreadable; cannot wake the optical sensor")
            return
        if ctrl1 & AFE_TIMEREN:
            return
        payload = Sensor(read=False, address=AFE_CONTROL1, data=ctrl1 | AFE_TIMEREN).encode()
        await self._client.write_gatt_char(CHR_SENSOR, payload, response=True)
        self._afe_restore = ctrl1
        self.sensor_woken = True
        log.info("Optical front-end was idle; enabled its timing engine (reg 0x%02X)", AFE_CONTROL1)

    async def _async_read_sensor_reg(self, address: int, timeout: float = 1.0) -> Optional[int]:
        self._sensor_reply = asyncio.get_running_loop().create_future()
        self._sensor_reply_addr = address
        try:
            await self._client.write_gatt_char(
                CHR_SENSOR, Sensor(read=True, address=address).encode(), response=True)
            reply = await asyncio.wait_for(self._sensor_reply, timeout)
        except Exception as exc:
            log.debug("Sensor register 0x%02X read failed: %s", address, exc)
            return None
        finally:
            self._sensor_reply = None
        return reply.data

    def stop_stream(self):
        with self._op_lock:
            if self._client is not None and self._streaming:
                try:
                    self._run(self._async_stop_stream(), timeout=10)
                except Exception as exc:
                    log.warning("Mendi stop-stream failed: %s", exc)
            self._streaming = False

    async def _async_stop_stream(self):
        if self._afe_restore is not None:
            # The setting survives a disconnect; leaving it on drains the battery
            try:
                payload = Sensor(read=False, address=AFE_CONTROL1, data=self._afe_restore).encode()
                await self._client.write_gatt_char(CHR_SENSOR, payload, response=True)
            except Exception as exc:
                log.warning("Could not restore optical front-end state: %s", exc)
            self._afe_restore = None
        try:
            await self._client.write_gatt_char(CHR_SENSOR, SENSOR_DISABLE_PAYLOAD, response=True)
        except Exception:
            pass
        try:
            await self._client.stop_notify(CHR_FRAME)
        except Exception:
            pass

    def set_calibration(self, offset_l: float = 0.0, offset_r: float = 0.0,
                        offset_p: float = 0.0, auto: bool = True, low_power: bool = False):
        """Write LED-current offsets / auto-calibration (advanced; mA, ±127)."""
        if not self.is_connected:
            raise RuntimeError("Not connected")
        payload = Calibration(offset_l, offset_r, offset_p, auto, low_power).encode()
        with self._op_lock:
            self._run(self._client.write_gatt_char(CHR_CALIBRATION, payload, response=True))

    # ── Notification handlers (run on the BLE loop thread) ─────────
    def _on_frame(self, _sender, data: bytearray):
        frame = decode_frame(bytes(data))
        if frame is None:
            self._invalid += 1
            return
        frame.timestamp = time.time()
        with self._lock:
            if len(self._frames) == self._frames.maxlen:
                self._dropped += 1
            self._frames.append(frame)
        self._last_frame_time = frame.timestamp
        self._frame_total += 1

    def _on_adc(self, _sender, data: bytearray):
        a = decode_adc(bytes(data))
        if a:
            self.battery = {"voltage_mv": a.voltage, "percent": a.percent,
                            "charging": a.charging, "usb": a.usb}

    def _on_diagnostics(self, _sender, data: bytearray):
        d = decode_diagnostics(bytes(data))
        if not d:
            return
        self.diagnostics = {"imu_ok": d.imu_ok, "sensor_ok": d.sensor_ok,
                            "voltage_mv": d.adc.voltage if d.adc else None}
        if d.adc and self.battery is None:
            self.battery = {"voltage_mv": d.adc.voltage, "percent": d.adc.percent,
                            "charging": d.adc.charging, "usb": d.adc.usb}

    def _on_calibration(self, _sender, data: bytearray):
        c = decode_calibration(bytes(data))
        if c:
            self.calibration = {"offset_l": round(c.offset_l, 2), "offset_r": round(c.offset_r, 2),
                                "offset_p": round(c.offset_p, 2), "auto": c.enable,
                                "low_power": c.low_power_mode}

    def _on_sensor(self, _sender, data: bytearray):
        s = decode_sensor(bytes(data))
        if s:
            self.last_sensor_read = {"address": s.address, "data": s.data}
            fut = self._sensor_reply
            if fut is not None and not fut.done() and s.address == self._sensor_reply_addr:
                fut.set_result(s)

    # ── Data interface ─────────────────────────────────────────────
    def drain(self) -> list[Frame]:
        """Return and clear all frames received since the last call."""
        with self._lock:
            frames = list(self._frames)
            self._frames.clear()
        return frames

    # ── Status ─────────────────────────────────────────────────────
    @property
    def is_connected(self) -> bool:
        return self._connected and self._client is not None

    @property
    def is_streaming(self) -> bool:
        return self._streaming and self.is_connected

    @property
    def device_info(self) -> dict:
        if not self._connected:
            return {}
        stale = (self._last_frame_time is not None and time.time() - self._last_frame_time > 3)
        return {
            "device_name": self._name,
            "address": self._address,
            "model": "Mendi",
            "firmware": self._firmware,
            "hardware": self._hardware,
            "fcc_id": MENDI_FCC_ID,
            "battery": self.battery,
            "calibration": self.calibration,
            "diagnostics": self.diagnostics,
            "frames_dropped": self._dropped,
            "frames_invalid": self._invalid,
            "data_stale": stale,
            "sensor_woken": self.sensor_woken,
        }

    def close(self):
        with self._op_lock:
            self.disconnect()
            loop, thread = self._loop, self._thread
            self._loop = self._thread = None
            if loop is None:
                return
            loop.call_soon_threadsafe(loop.stop)
            if thread is not None:
                thread.join(timeout=5)
            if thread is None or not thread.is_alive():
                loop.close()
            else:
                log.warning("Mendi BLE loop thread did not stop within 5 s")

    @staticmethod
    def _looks_like_address(s: str) -> bool:
        return (len(s) == 17 and s.count(":") == 5) or (len(s) == 36 and s.count("-") == 4)
