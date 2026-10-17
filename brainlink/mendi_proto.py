"""
Minimal protobuf codec for the Mendi V4 BLE wire protocol.

The Mendi headband sends proto3 messages on six GATT characteristics
(see ``device_v4.proto`` in https://github.com/eugenehp/mendi, MIT).  The
messages are tiny and flat, so instead of pulling in ``protobuf`` + generated
code we hand-decode the handful of wire types they use:

    varint (0)   int32 / uint32 / bool
    fixed32 (5)  float / fixed32
    len (2)      bytes / embedded message

Schema (field numbers)::

    Frame        acc_x=1 acc_y=2 acc_z=3 ang_x=4 ang_y=5 ang_z=6 temp=7(float)
                 ir_l=8 red_l=9 amb_l=10 ir_r=11 red_r=12 amb_r=13
                 ir_p=14 red_p=15 amb_p=16
    Sensor       read=1(bool) address=2(uint32) data=3(fixed32)
    Imu          read=1(uint32, bytes to read) address=2 data=3(bytes)  [not used here]
    Adc          voltage=1(mV) charging=2(bool) usb=3(bool)
    Diagnostics  adc=1(Adc) imu_ok=2(bool) sensor_ok=3(bool)
    Calibration  offset_l=1 offset_r=2 offset_p=3 (float) enable=4 low_power_mode=5 (bool)
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Iterator, Optional

# ─── Wire primitives ──────────────────────────────────────────────────

WT_VARINT, WT_I64, WT_LEN, WT_I32 = 0, 1, 2, 5


class ProtoDecodeError(ValueError):
    pass


def _read_varint(buf: bytes, pos: int) -> tuple[int, int]:
    result = shift = 0
    while True:
        if pos >= len(buf):
            raise ProtoDecodeError("truncated varint")
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, pos
        shift += 7
        if shift >= 64:
            raise ProtoDecodeError("varint too long")


def _iter_fields(buf: bytes) -> Iterator[tuple[int, int, object]]:
    """Yield ``(field_number, wire_type, raw_value)`` for every field."""
    pos = 0
    n = len(buf)
    while pos < n:
        key, pos = _read_varint(buf, pos)
        fnum, wtype = key >> 3, key & 0x07
        if fnum == 0:
            raise ProtoDecodeError("field number 0")
        if wtype == WT_VARINT:
            val, pos = _read_varint(buf, pos)
        elif wtype == WT_I32:
            if pos + 4 > n:
                raise ProtoDecodeError("truncated fixed32")
            val = buf[pos:pos + 4]
            pos += 4
        elif wtype == WT_I64:
            if pos + 8 > n:
                raise ProtoDecodeError("truncated fixed64")
            val = buf[pos:pos + 8]
            pos += 8
        elif wtype == WT_LEN:
            ln, pos = _read_varint(buf, pos)
            if pos + ln > n:
                raise ProtoDecodeError("truncated length-delimited field")
            val = buf[pos:pos + ln]
            pos += ln
        else:
            raise ProtoDecodeError(f"unsupported wire type {wtype}")
        yield fnum, wtype, val


def _as_int32(v: int) -> int:
    """proto3 int32: negative values are sign-extended to 64 bits on the wire."""
    v &= 0xFFFFFFFFFFFFFFFF
    if v >= 1 << 63:
        v -= 1 << 64
    # Truncate to 32-bit two's complement like protobuf does
    v &= 0xFFFFFFFF
    return v - (1 << 32) if v >= 1 << 31 else v


def _as_float(raw: bytes) -> float:
    return struct.unpack("<f", raw)[0]


def _enc_varint(v: int) -> bytes:
    v &= 0xFFFFFFFFFFFFFFFF  # negative int32 → 10-byte varint, as protobuf does
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def _enc_key(fnum: int, wtype: int) -> bytes:
    return _enc_varint((fnum << 3) | wtype)


# ─── Messages ─────────────────────────────────────────────────────────

FRAME_INT_FIELDS = {
    1: "acc_x", 2: "acc_y", 3: "acc_z",
    4: "ang_x", 5: "ang_y", 6: "ang_z",
    8: "ir_l", 9: "red_l", 10: "amb_l",
    11: "ir_r", 12: "red_r", 13: "amb_r",
    14: "ir_p", 15: "red_p", 16: "amb_p",
}

ACCEL_SCALE_G = 2.0 / 32768.0      # ±2 G full scale, int16
GYRO_SCALE_DPS = 125.0 / 32768.0   # ±125 °/s full scale, int16


@dataclass
class Frame:
    acc_x: int = 0
    acc_y: int = 0
    acc_z: int = 0
    ang_x: int = 0
    ang_y: int = 0
    ang_z: int = 0
    temp: float = 0.0
    ir_l: int = 0
    red_l: int = 0
    amb_l: int = 0
    ir_r: int = 0
    red_r: int = 0
    amb_r: int = 0
    ir_p: int = 0
    red_p: int = 0
    amb_p: int = 0
    timestamp: float = 0.0  # host receive time (s), not on the wire

    @property
    def accel_g(self) -> tuple[float, float, float]:
        return (self.acc_x * ACCEL_SCALE_G, self.acc_y * ACCEL_SCALE_G, self.acc_z * ACCEL_SCALE_G)

    @property
    def gyro_dps(self) -> tuple[float, float, float]:
        return (self.ang_x * GYRO_SCALE_DPS, self.ang_y * GYRO_SCALE_DPS, self.ang_z * GYRO_SCALE_DPS)

    def encode(self) -> bytes:
        out = bytearray()
        for fnum, name in FRAME_INT_FIELDS.items():
            v = getattr(self, name)
            if fnum == 8:  # keep field order: temp (7) goes before ir_l (8)
                if self.temp:
                    out += _enc_key(7, WT_I32) + struct.pack("<f", self.temp)
            if v:
                out += _enc_key(fnum, WT_VARINT) + _enc_varint(v)
        return bytes(out)


def decode_frame(data: bytes) -> Optional[Frame]:
    """Decode a Frame (0xABB1) notification. Returns ``None`` if empty/corrupt."""
    if not data:
        return None  # proto3 would decode to all zeros; the app rejects it too
    f = Frame()
    try:
        for fnum, wtype, val in _iter_fields(bytes(data)):
            if fnum == 7 and wtype == WT_I32:
                f.temp = _as_float(val)  # type: ignore[arg-type]
            elif fnum in FRAME_INT_FIELDS and wtype == WT_VARINT:
                setattr(f, FRAME_INT_FIELDS[fnum], _as_int32(val))  # type: ignore[arg-type]
            # unknown fields are skipped, as protobuf does
    except ProtoDecodeError:
        return None
    return f


@dataclass
class Adc:
    voltage: int = 0      # mV
    charging: bool = False
    usb: bool = False

    # Same mapping as the Mendi app: 3.6 V → 0 %, 4.1 V → 100 %
    V_MIN_MV = 3600
    V_MAX_MV = 4100

    @property
    def percent(self) -> int:
        span = self.V_MAX_MV - self.V_MIN_MV
        pct = (self.voltage - self.V_MIN_MV) * 100.0 / span
        return int(max(0, min(100, round(pct))))


def decode_adc(data: bytes) -> Optional[Adc]:
    a = Adc()
    try:
        for fnum, wtype, val in _iter_fields(bytes(data)):
            if wtype != WT_VARINT:
                continue
            if fnum == 1:
                a.voltage = int(val) & 0xFFFFFFFF  # type: ignore[arg-type]
            elif fnum == 2:
                a.charging = bool(val)
            elif fnum == 3:
                a.usb = bool(val)
    except ProtoDecodeError:
        return None
    return a


@dataclass
class Diagnostics:
    adc: Optional[Adc] = None
    imu_ok: bool = False
    sensor_ok: bool = False


def decode_diagnostics(data: bytes) -> Optional[Diagnostics]:
    d = Diagnostics()
    try:
        for fnum, wtype, val in _iter_fields(bytes(data)):
            if fnum == 1 and wtype == WT_LEN:
                d.adc = decode_adc(val)  # type: ignore[arg-type]
            elif fnum == 2 and wtype == WT_VARINT:
                d.imu_ok = bool(val)
            elif fnum == 3 and wtype == WT_VARINT:
                d.sensor_ok = bool(val)
    except ProtoDecodeError:
        return None
    return d


@dataclass
class Calibration:
    offset_l: float = 0.0
    offset_r: float = 0.0
    offset_p: float = 0.0
    enable: bool = False
    low_power_mode: bool = False

    def encode(self) -> bytes:
        out = bytearray()
        for fnum, v in ((1, self.offset_l), (2, self.offset_r), (3, self.offset_p)):
            if v:
                out += _enc_key(fnum, WT_I32) + struct.pack("<f", v)
        if self.enable:
            out += _enc_key(4, WT_VARINT) + b"\x01"
        if self.low_power_mode:
            out += _enc_key(5, WT_VARINT) + b"\x01"
        return bytes(out)


def decode_calibration(data: bytes) -> Optional[Calibration]:
    c = Calibration()
    names = {1: "offset_l", 2: "offset_r", 3: "offset_p"}
    try:
        for fnum, wtype, val in _iter_fields(bytes(data)):
            if fnum in names and wtype == WT_I32:
                setattr(c, names[fnum], _as_float(val))  # type: ignore[arg-type]
            elif fnum == 4 and wtype == WT_VARINT:
                c.enable = bool(val)
            elif fnum == 5 and wtype == WT_VARINT:
                c.low_power_mode = bool(val)
    except ProtoDecodeError:
        return None
    return c


@dataclass
class Sensor:
    read: bool = False
    address: int = 0
    data: int = 0  # 24-bit value in the low bytes

    def encode(self) -> bytes:
        out = bytearray()
        if self.read:
            out += _enc_key(1, WT_VARINT) + b"\x01"
        if self.address:
            out += _enc_key(2, WT_VARINT) + _enc_varint(self.address)
        if self.data:
            out += _enc_key(3, WT_I32) + struct.pack("<I", self.data & 0xFFFFFFFF)
        return bytes(out)


def decode_sensor(data: bytes) -> Optional[Sensor]:
    s = Sensor()
    try:
        for fnum, wtype, val in _iter_fields(bytes(data)):
            if fnum == 1 and wtype == WT_VARINT:
                s.read = bool(val)
            elif fnum == 2 and wtype == WT_VARINT:
                s.address = int(val) & 0xFFFFFFFF  # type: ignore[arg-type]
            elif fnum == 3 and wtype == WT_I32:
                s.data = struct.unpack("<I", val)[0]  # type: ignore[arg-type]
    except ProtoDecodeError:
        return None
    return s


# The Mendi app enables the optical sensor by writing Sensor{read=true}
# (an encoded b"\x08\x01") and disables it with an empty Sensor message.
SENSOR_ENABLE_PAYLOAD = Sensor(read=True).encode()
SENSOR_DISABLE_PAYLOAD = Sensor(read=False).encode()
