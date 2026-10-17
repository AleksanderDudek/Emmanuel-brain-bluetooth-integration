"""Tests for the Mendi fNIRS integration (no hardware needed)."""

import struct
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brainlink.fnirs import FNIRSConfig, FNIRSPipeline, mbll_matrix_inv  # noqa: E402
from brainlink.fnirs_simulator import FNIRSSimulator  # noqa: E402
from brainlink.mendi_ble import CHR_FRAME, SVC_MENDI  # noqa: E402
from brainlink.mendi_proto import (  # noqa: E402
    Adc, Calibration, Frame, Sensor, SENSOR_DISABLE_PAYLOAD, SENSOR_ENABLE_PAYLOAD,
    decode_adc, decode_calibration, decode_diagnostics, decode_frame, decode_sensor,
)


# ─── Protocol ─────────────────────────────────────────────────────────

def test_uuids():
    assert SVC_MENDI == "fc3eabb0-c6c4-49e6-922a-6e551c455af5"
    assert CHR_FRAME == "fc3eabb1-c6c4-49e6-922a-6e551c455af5"


def test_frame_roundtrip_with_negative_values():
    f = Frame(acc_x=-1234, acc_y=5, acc_z=16384, ang_x=-1, temp=33.25,
              ir_l=52000, red_l=31000, amb_l=900, ir_r=49000, red_r=-7, amb_r=0,
              ir_p=61000, red_p=38000, amb_p=700)
    g = decode_frame(f.encode())
    assert g is not None
    for k in ("acc_x", "acc_y", "acc_z", "ang_x", "ir_l", "red_l", "amb_l",
              "ir_r", "red_r", "amb_r", "ir_p", "red_p", "amb_p"):
        assert getattr(g, k) == getattr(f, k), k
    assert g.temp == pytest.approx(33.25)


def test_frame_hand_encoded_bytes():
    # acc_x = -1 (10-byte varint), temp = 1.5f, ir_l = 300
    data = bytes([0x08]) + b"\xff" * 9 + b"\x01"
    data += bytes([0x3D]) + struct.pack("<f", 1.5)
    data += bytes([0x40, 0xAC, 0x02])
    f = decode_frame(data)
    assert f.acc_x == -1 and f.temp == 1.5 and f.ir_l == 300


def test_frame_rejects_empty_and_corrupt():
    assert decode_frame(b"") is None
    assert decode_frame(b"\x40") is None          # truncated varint
    assert decode_frame(b"\x3d\x00\x00") is None  # truncated float


def test_frame_skips_unknown_fields():
    data = bytes([0x40, 0x05]) + bytes([0xA8, 0x06, 0x07])  # ir_l=5, field 101=7
    assert decode_frame(data).ir_l == 5


def test_adc_and_diagnostics():
    adc = bytes([0x08, 0xB6, 0x1B, 0x10, 0x01])  # voltage 3510, charging
    a = decode_adc(adc)
    assert a.voltage == 3510 and a.charging and not a.usb and a.percent == 0
    assert Adc(voltage=3850).percent == 50
    diag = bytes([0x0A, len(adc)]) + adc + bytes([0x10, 0x01, 0x18, 0x01])
    d = decode_diagnostics(diag)
    assert d.imu_ok and d.sensor_ok and d.adc.voltage == 3510


def test_calibration_and_sensor_roundtrip():
    c = decode_calibration(Calibration(1.5, -2.0, 0.0, True, False).encode())
    assert c.offset_l == 1.5 and c.offset_r == -2.0 and c.enable and not c.low_power_mode
    s = decode_sensor(Sensor(read=False, address=0x11, data=0xABCDEF).encode())
    assert s.address == 0x11 and s.data == 0xABCDEF
    assert SENSOR_ENABLE_PAYLOAD == b"\x08\x01"
    assert SENSOR_DISABLE_PAYLOAD == b""


def test_matches_official_protobuf_library():
    """Cross-check our hand codec against google.protobuf, if installed."""
    pb = pytest.importorskip("google.protobuf")  # noqa: F841
    from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

    fdp = descriptor_pb2.FileDescriptorProto(name="mendi_test.proto", package="mendi", syntax="proto3")
    msg = fdp.message_type.add(name="Frame")
    T = descriptor_pb2.FieldDescriptorProto
    names = ["acc_x", "acc_y", "acc_z", "ang_x", "ang_y", "ang_z", "temp",
             "ir_l", "red_l", "amb_l", "ir_r", "red_r", "amb_r", "ir_p", "red_p", "amb_p"]
    for i, n in enumerate(names, start=1):
        msg.field.add(name=n, number=i, label=T.LABEL_OPTIONAL,
                      type=T.TYPE_FLOAT if n == "temp" else T.TYPE_INT32)
    pool = descriptor_pool.DescriptorPool()
    pool.Add(fdp)
    cls = message_factory.GetMessageClass(pool.FindMessageTypeByName("mendi.Frame"))

    rng = np.random.default_rng(1)
    for _ in range(50):
        vals = {n: int(rng.integers(-2**31, 2**31 - 1)) for n in names if n != "temp"}
        vals["temp"] = float(np.float32(rng.normal(33, 2)))
        wire = cls(**vals).SerializeToString()
        ours = decode_frame(wire)
        for n in names:
            assert getattr(ours, n) == pytest.approx(vals[n]), n
        # and the other direction
        back = cls()
        back.ParseFromString(Frame(**vals).encode())
        for n in names:
            assert getattr(back, n) == pytest.approx(vals[n]), n


# ─── Pipeline ─────────────────────────────────────────────────────────

def test_mbll_inverse_recovers_concentrations():
    cfg = FNIRSConfig()
    minv = mbll_matrix_inv(cfg)
    m = np.linalg.inv(minv / 1e6)
    hb = np.array([0.8e-6, -0.3e-6])  # M
    od = m @ hb
    assert np.allclose(minv @ od, [0.8, -0.3])


def test_simulator_task_increases_hbo_and_decreases_hbr():
    fs = 25.0
    sim = FNIRSSimulator(fs=fs, seed=0)
    pipe = FNIRSPipeline(fs=fs)
    sim.set_state("rest")
    pipe.push(sim.generate(int(40 * fs)))   # baseline + settle
    assert pipe.baseline_ready
    rest_hbo = np.mean(list(pipe.hbo["left"])[-int(10 * fs):])
    rest_hbr = np.mean(list(pipe.hbr["left"])[-int(10 * fs):])
    sim.set_state("high_load")
    pipe.push(sim.generate(int(20 * fs)))
    task_hbo = np.mean(list(pipe.hbo["left"])[-int(8 * fs):])
    task_hbr = np.mean(list(pipe.hbr["left"])[-int(8 * fs):])
    truth = sim.truth
    # Recovered changes should track the simulated ground truth (left side)
    assert task_hbo - rest_hbo == pytest.approx(truth["hbo"]["l"], rel=0.25)
    assert task_hbr - rest_hbr == pytest.approx(truth["hbr"]["l"], rel=0.35)


def test_heart_rate_and_quality():
    fs = 25.0
    sim = FNIRSSimulator(fs=fs, seed=2)
    pipe = FNIRSPipeline(fs=fs)
    pipe.push(sim.generate(int(30 * fs)))
    hr = pipe.heart_rate()
    assert hr is not None and 55 < hr < 85
    q = pipe.signal_quality()
    assert q["left"]["label"] in ("good", "fair")
    assert not pipe.motion()


def test_motion_and_poor_contact_detected():
    fs = 25.0
    sim = FNIRSSimulator(fs=fs, seed=3)
    pipe = FNIRSPipeline(fs=fs)
    sim.set_state("motion")
    pipe.push(sim.generate(int(5 * fs)))
    assert pipe.motion()
    sim.set_state("poor_contact")
    pipe.push(sim.generate(int(20 * fs)))
    assert pipe.signal_quality()["left"]["ambient_ratio"] > 0.3


def test_snapshot_is_json_safe():
    import json
    pipe = FNIRSPipeline()
    sim = FNIRSSimulator(seed=4)
    pipe.push(sim.generate(10))
    json.dumps(pipe.snapshot(), allow_nan=False)
    pipe.push(sim.generate(400))
    json.dumps(pipe.snapshot(), allow_nan=False)


def test_config_validation():
    pipe = FNIRSPipeline()
    with pytest.raises(ValueError):
        pipe.set_config(red_nm=123)
    with pytest.raises(ValueError):
        pipe.set_config(hp_hz=1.0)
    cfg = pipe.set_config(ir_nm=940, separation_cm=2.5, hp_hz=0.005)
    assert cfg.ir_nm == 940 and not pipe.baseline_ready
