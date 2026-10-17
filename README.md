# BrainLink — EEG-to-Game Real-time Engine

A self-contained desktop application that processes **BrainAccess HALO** EEG
data and **Mendi** fNIRS data (or simulated data for either) and exposes
game-ready brain metrics in real time over WebSocket and a REST API.

```
brainlink-desktop/
├── run.py              ← One-command launcher (creates venv, installs deps, starts server)
├── server.py           ← FastAPI app — routes + background EEG loop
├── brainlink/          ← Core pipeline package
│   ├── constants.py    ← Shared constants (sample rate, bands, channels, …)
│   ├── simulator.py    ← EEG simulator with mental-state scenarios
│   ├── dsp.py          ← Ring buffers + band-power extraction (Welch PSD)
│   ├── features.py     ← Metric engine + combo detector
│   ├── calibration.py  ← Guided calibration session
│   ├── recorder.py     ← CSV + JSON session recorder
│   ├── halo_ble.py     ← macOS BLE adapter (bleak / CoreBluetooth)
│   ├── halo_sdk.py     ← Official SDK adapter (Windows / Linux)
│   ├── mendi_proto.py  ← Mendi V4 protobuf codec (no protobuf dependency)
│   ├── mendi_ble.py    ← Mendi fNIRS BLE adapter (bleak)
│   ├── fnirs.py        ← fNIRS pipeline: ambient → ΔOD → MBLL → ΔHbO/ΔHbR, HR, SCI
│   ├── fnirs_simulator.py ← Mendi-like frame simulator (block-design scenarios)
│   ├── fnirs_balance.py   ← Hemispheric balance tracker (trainer view)
│   ├── fnirs_recorder.py  ← fNIRS CSV recorder with event markers
│   └── fnirs_api.py    ← /api/v1/fnirs/* router + WebSocket + loop
├── dashboard/
│   ├── index.html      ← Real-time EEG dashboard
│   ├── fnirs.html      ← Real-time fNIRS dashboard (/fnirs, /fnirs#balance)
│   └── fnirs-balance.js ← Balance trainer view + task bank
├── tests/              ← pytest suite (no hardware needed)
├── web/                ← fNIRS web app (PWA): Web Bluetooth, offline, no server needed
├── recordings/         ← Saved EEG sessions (gitignored)
├── requirements.txt
├── requirements-dev.txt ← pytest, httpx, protobuf (tests only)
└── LICENSE
```

## Quick start

```bash
python run.py
```

The launcher will:
1. Create a Python virtual environment (`.venv/`)
2. Install all dependencies from `requirements.txt`
3. Start the server on port **8420**
4. Open your browser to the dashboard

```bash
python run.py --port 9000    # custom port
python run.py --no-open      # skip auto-opening browser
python run.py --install      # install deps only
```

## Requirements

- **Python 3.10+**
- No other manual setup required — everything is installed automatically

## What you get

### Real-time dashboard  `http://localhost:8420`

| Panel | Contents |
|---|---|
| Metrics | 6 animated bars: Focus · Calm · Valence · Instability · Stress · Flow |
| EEG traces | 4 channels (Fp1, Fp2, O1, O2) at 10 Hz |
| Band powers | Delta / Theta / Alpha / Beta / Gamma per channel |
| Combos | Active combo states: `super_flow` · `panic` · `zen_heal` · `berserker` |
| Calibration | Step-by-step guided flow |
| Settings | Live sliders for sensitivity, dead-zone, and smoothing per metric |
| Simulator | 6 manual states + 4 auto-scenarios |

### WebSocket stream  `ws://localhost:8420/api/v1/stream`

10 Hz push, JSON frame:

```json
{
  "ts": 1710684600123,
  "metrics": { "focus": 0.72, "calm": 0.15, "valence": 0.61,
               "instability": 0.08, "stress": 0.34, "flow": 0.45 },
  "active_combos": ["super_flow"],
  "combo_timers": { "super_flow": { "active_sec": 2.1 } },
  "band_powers": { "Fp1": { "delta": 0.4, "theta": 0.9, "alpha": 5.3,
                             "beta": 3.8, "gamma": 0.1 } },
  "raw_preview": { "Fp1": [-2.3, 1.1, 0.8, -0.5] },
  "blink_count": 0,
  "source": "simulator",
  "simulator": { "state": "focus", "auto_mode": false }
}
```

### REST API  `http://localhost:8420/docs`

Full Swagger UI at `/docs`.  Key endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/calibration/start` | Begin guided calibration |
| `POST` | `/api/v1/calibration/{id}/step/{step}/complete` | Advance one calibration step |
| `GET`  | `/api/v1/users/{id}/settings` | Read metric settings |
| `PATCH`| `/api/v1/users/{id}/settings` | Partial-update metric settings |
| `GET`  | `/api/v1/device/status` | Hardware / source status |
| `POST` | `/api/v1/device/scan` | Scan for BLE devices |
| `POST` | `/api/v1/device/connect` | Connect to HALO |
| `POST` | `/api/v1/recording/start` | Start a session recording |
| `POST` | `/api/v1/debug/set-state/{state}` | Change simulator state |

### EEG simulator

| State | What it simulates |
|---|---|
| `baseline` | Resting, eyes open — neutral activity |
| `eyes_closed` | Occipital alpha surge |
| `focus` | High frontal beta, suppressed alpha |
| `stress` | Noisy high-beta, blink artifacts |
| `panic_spike` | Extreme stress with theta bursts |
| `flow` | Fronto-occipital alpha-beta synchrony |

**Auto-scenarios** loop through realistic gaming sessions automatically:
`gaming_session` · `horror_game` · `meditation_trainer` · `crafting_focus`

## Connecting a real HALO device

The server auto-detects which backend is available:

| Platform | Backend | Install |
|---|---|---|
| macOS | `bleak` BLE adapter | already in `requirements.txt` |
| Windows / Linux | BrainAccess SDK | `pip install brainaccess` |

Once a device is connected, switch the source via the dashboard or:

```bash
curl -X POST http://localhost:8420/api/v1/device/connect \
     -H "Content-Type: application/json" \
     -d '{"device_name": "BA HALO 001"}'

curl -X POST http://localhost:8420/api/v1/source/device
```

## Mendi fNIRS headband

The [Mendi](https://www.mendi.io/) is a consumer fNIRS band over the
prefrontal cortex.  Mendi has **no official SDK**; this integration speaks its
BLE protocol directly, based on the open-source, reverse-engineered client
[eugenehp/mendi](https://github.com/eugenehp/mendi) (MIT).  A firmware update
could break it.

Open **`http://localhost:8420/fnirs`**, close the Mendi phone app (the band
accepts one BLE connection at a time), switch the band on and click
**Połącz z pierwszą**.  Sit still for ~10 s while the baseline is collected.

### What you get

| Output | Notes |
|---|---|
| ΔHbO / ΔHbR (µM), left & right | Modified Beer–Lambert law on ambient-corrected red/IR, 0.5 Hz low-pass |
| Heart rate | From the central "pulse" optical channel |
| Signal quality | Scalp Coupling Index per channel, ambient-light leak, no-signal |
| Motion flag | From the band's accelerometer / gyroscope |
| `activation`, `asymmetry` (0–1) | Game-friendly metrics relative to the last 60 s |
| Raw frames | IR / red / ambient × 3 channels, IMU, temperature (~31 Hz) |

### API (`/api/v1/fnirs`, all under `/docs`)

| Method | Path | Description |
|---|---|---|
| `GET`  | `/status` | Source, device, baseline, recording |
| `POST` | `/device/scan` | Find Mendi bands |
| `POST` | `/device/connect` | `{"device": "Mendi"}` (name substring or address) |
| `POST` | `/device/start-stream` | Start streaming and switch source to the device |
| `POST` | `/source/{simulator\|device\|off}` | Choose data source |
| `POST` | `/baseline/reset` | Re-collect the I0 baseline |
| `PATCH`| `/config` | Wavelengths, separation, DPF, filters |
| `POST` | `/recording/start` · `/recording/stop` | CSV session in `recordings/fnirs/` |
| `POST` | `/marker` | `{"label": "task_start"}` — event marker in the recording (400 if not recording) |
| `POST` | `/simulator/{state}` | `rest`, `task`, `high_load`, `relax`, `motion`, `poor_contact`, `lateral_left`, `lateral_right`, `auto:block_design`, `auto:n_back`, `auto:meditation`, `auto:balance` |
| `GET`  | `/balance` | Hemispheric balance: smoothed asymmetry, zone, recommendation, session stats |
| `PATCH`| `/balance/config` | `low`, `high` (balanced band, default 0.47–0.53), `hysteresis`, `smoothing_sec`, `dwell_sec`, `warmup_sec` |
| `POST` | `/balance/reset` | Clear the session statistics |
| `WS`   | `/stream` | 10 Hz JSON frames; send `{"action":"marker","label":"…"}` to mark |

```bash
curl -X POST localhost:8420/api/v1/fnirs/device/connect -H 'Content-Type: application/json' -d '{"device":"Mendi"}'
curl -X POST localhost:8420/api/v1/fnirs/device/start-stream
curl -X POST localhost:8420/api/v1/fnirs/recording/start -H 'Content-Type: application/json' -d '{"name":"pilot","duration_sec":600}'
```

The EEG and fNIRS pipelines are independent, so a HALO and a Mendi can stream
at the same time.

### Hemispheric balance trainer

The **Trening równowagi** tab of `/fnirs` (deep link `/fnirs#balance`) turns
the `asymmetry` metric into guided practice aimed at balance:

| Smoothed asymmetry | Zone | Recommendation | The view shows |
|---|---|---|---|
| > `high` (0.53) | right dominates | `train_left` | left-hemisphere tasks: mental arithmetic, serial subtraction, verbal fluency, spelling backwards |
| < `low` (0.47) | left dominates | `train_right` | right-hemisphere tasks: mental rotation (normal vs. mirrored letter), spatial imagery, melody / face recall |
| `low`…`high` | balanced | `focus` | hold attention on a point in the middle of the forehead and notice the sensations there |

The raw metric is noisy, so `BalanceTracker` (`brainlink/fnirs_balance.py`)
smooths it (EMA, 4 s), uses hysteresis (0.01) on the band edges, waits 15 s
after each baseline, and changes the recommendation only after a zone has
persisted for 5 s.  Feedback is held during motion or poor optode contact.
The same `balance` block is in every `/stream` frame, so a game can use it
directly.  While a recording runs and the trainer tab is open, each
recommendation change is stored as a `balance:<recommendation>` marker (the
marker means "this task was shown").  Settings live in server memory (not
persisted across restarts).

Mapping tasks to hemispheres is a simplification — prefrontal responses are
largely bilateral and the band sees only part of the cortex.  Use it for
experiments and neurofeedback, not diagnosis or therapy.

### Caveats

- Tested on firmware 1.0.1 / hardware r2.1b-ty1.  That firmware leaves the
  optical front-end idle (one frame per connection, then silence), unlike what
  the upstream client describes.  If no frames arrive within ~1 s of starting
  the stream, the adapter sets the front-end's timer-enable bit (register 0x1E,
  TI AFE4404-style layout) and restores the original value on stop, because
  the setting survives a disconnect and would otherwise drain the battery.
  `device.sensor_woken` in `/status` shows when this happened.
- Frames arrive at ~30.6 Hz on that firmware (upstream assumes 25 Hz) and
  carry no device timestamp.  The pipeline switches to the measured rate if it
  differs by more than 10 %.
- Mendi does not publish LED wavelengths, source–detector separation or DPF.
  Defaults are 660 / 850 nm, 3 cm, DPF 6 — **treat ΔHbO/ΔHbR as relative**
  and change them via `PATCH /config` if you know better.
- The live pipeline is causal (no high-pass by default, since any causal
  high-pass shrinks sustained responses).  For analysis, use the recorded raw
  intensities with zero-phase filtering offline (e.g. MNE-NIRS).
- Consumer device, prefrontal only, few channels: good for prototyping and
  neurofeedback, not a substitute for a research-grade fNIRS system.

## Web app (no server)

`web/` is the Mendi fNIRS part as an installable Progressive Web App: Web
Bluetooth, the full pipeline and balance trainer in the browser, sessions in
IndexedDB or a local folder, works offline. Chrome/Edge/Opera on Windows,
macOS, Android and ChromeOS; iOS through the Bluefy browser. See
[web/README.md](web/README.md).

```bash
cd web && npm ci && npm run dev
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Project structure

```
brainlink/
├── constants.py   — sample rate, channel list, frequency bands
├── simulator.py   — EEGSimulator class + AUTO_SCENARIOS
├── dsp.py         — DSPPipeline (ring buffer, Welch PSD, blink detector)
├── features.py    — FeatureEngine, CalibrationProfile, UserSettings
├── calibration.py — CalibrationSession (5-step guided flow)
├── recorder.py    — SessionRecorder (CSV + JSON output)
├── halo_ble.py    — HALOBleAdapter (macOS CoreBluetooth via bleak)
├── halo_sdk.py    — BrainAccessHALO (official SDK, Win/Linux)
├── mendi_proto.py — Mendi V4 protobuf messages (Frame, Adc, Calibration, …)
├── mendi_ble.py   — MendiBleAdapter (bleak, all platforms)
├── fnirs.py       — FNIRSPipeline, FNIRSConfig
├── fnirs_simulator.py — FNIRSSimulator + FNIRS_SCENARIOS
├── fnirs_balance.py   — BalanceTracker, BalanceConfig
├── fnirs_recorder.py  — FNIRSRecorder (CSV + JSON, event markers)
└── fnirs_api.py   — FastAPI router, WebSocket and background loop
```

## License

[GNU Affero General Public License v3.0](LICENSE) — you may use, study, and modify this software freely, but any distributed or network-hosted derivative must also be released under AGPL v3. Commercial use requires the author's written permission.
