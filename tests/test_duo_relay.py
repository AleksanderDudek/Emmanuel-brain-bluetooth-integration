"""Tests for the two-screen games relay and the /app/ web app route (brainlink/duo_api.py)."""

import asyncio
import html
import sys
import threading
import time
from contextlib import ExitStack
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("httpx")
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

import brainlink.duo_api as duo  # noqa: E402

WS = "/api/v1/duo/ws"


@pytest.fixture
def client():
    duo._rooms.clear()
    duo._joins.clear()
    app = FastAPI()
    app.include_router(duo.router)               # router only, like the fNIRS API tests
    with TestClient(app) as c:                   # one event loop shared by every socket of a test
        yield c
    duo._rooms.clear()


def connect(c, room, role, cid):
    return c.websocket_connect(f"{WS}/{room}?role={role}&id={cid}")


def recv(ws, text=False, timeout=5.0):
    """receive_json / receive_text with a timeout: a missing message fails the test instead of hanging it."""
    box = {}

    def run():
        try:
            box["msg"] = ws.receive_text() if text else ws.receive_json()
        except BaseException as exc:  # noqa: BLE001 — re-raised in the test thread
            box["exc"] = exc

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        pytest.fail(f"no message within {timeout} s")
    if "exc" in box:
        raise box["exc"]
    return box["msg"]


def closed_with(ws):
    with pytest.raises(WebSocketDisconnect) as e:
        recv(ws)
    return e.value.code, e.value.reason


def skip(*sockets):
    """Read (and discard) one message from each socket, in this order."""
    for ws in sockets:
        recv(ws)


def peer(event, role, cid):
    return {"t": "peer", "event": event, "role": role, "id": cid}


def wait_until(cond, timeout=2.0):
    end = time.monotonic() + timeout
    while not cond():
        if time.monotonic() > end:
            pytest.fail("condition not reached")
        time.sleep(0.01)


# ─── Relay ────────────────────────────────────────────────────────────

def test_board_and_pads_exchange_messages(client):
    with connect(client, "ABCD", "board", "b1") as board:
        assert recv(board) == {"t": "relay", "room": "ABCD", "role": "board", "id": "b1", "peers": []}
        with connect(client, "ABCD", "pad", "p1") as p1, connect(client, "ABCD", "pad", "p2") as p2:
            assert recv(p1) == {"t": "relay", "room": "ABCD", "role": "pad", "id": "p1",
                                "peers": [{"role": "board", "id": "b1"}]}
            assert recv(p2)["peers"] == [{"role": "board", "id": "b1"}]
            assert recv(board) == peer("join", "pad", "p1")
            assert recv(board) == peer("join", "pad", "p2")

            # pad → board: "from" is added, and a spoofed one is overwritten
            p1.send_json({"t": "tap", "x": 1, "from": "p2"})
            assert recv(board) == {"t": "tap", "x": 1, "from": "p1"}
            p2.send_json({"t": "tap", "x": 2})
            assert recv(board) == {"t": "tap", "x": 2, "from": "p2"}

            # board → one pad with "to", → every pad without it
            board.send_json({"t": "go", "to": "p2", "n": 1})
            board.send_json({"t": "all", "n": 2})
            assert recv(p2) == {"t": "go", "to": "p2", "n": 1}
            assert recv(p2) == {"t": "all", "n": 2}
            assert recv(p1) == {"t": "all", "n": 2}        # the targeted message never reached p1

            # board frames are passed on byte for byte, and in order
            raw = '{"t": "raw",   "v": [1, 2.50, "ż"]}'
            board.send_text(raw)
            assert recv(p1, text=True) == raw
            for i in range(30):
                board.send_json({"seq": i})
            assert [recv(p1)["seq"] for _ in range(30)] == list(range(30))


def test_peer_events_and_empty_rooms_are_deleted(client):
    with connect(client, "ROOM2", "pad", "p1") as p1:
        assert recv(p1)["peers"] == []
        with connect(client, "ROOM2", "board", "b1") as board:
            assert recv(board)["peers"] == [{"role": "pad", "id": "p1"}]
            assert recv(p1) == peer("join", "board", "b1")
            with connect(client, "ROOM2", "pad", "p2") as p2:
                recv(p2)
                assert recv(board) == peer("join", "pad", "p2")
            assert recv(board) == peer("leave", "pad", "p2")
        # pads hear only about the board, never about each other
        assert recv(p1) == peer("leave", "board", "b1")
        assert "ROOM2" in duo._rooms
    wait_until(lambda: "ROOM2" not in duo._rooms)


def test_a_reconnecting_board_replaces_its_old_socket(client):
    with connect(client, "ABCD", "board", "b1") as b1, connect(client, "ABCD", "pad", "p1") as pad:
        skip(b1, pad, b1)                              # welcomes, join
        with connect(client, "ABCD", "board", "b1") as again:
            assert closed_with(b1) == (4001, "replaced")
            assert recv(again) == {"t": "relay", "room": "ABCD", "role": "board", "id": "b1",
                                   "peers": [{"role": "pad", "id": "p1"}]}
            assert recv(pad) == peer("leave", "board", "b1")
            assert recv(pad) == peer("join", "board", "b1")
            pad.send_json({"t": "hi"})
            assert recv(again) == {"t": "hi", "from": "p1"}


def test_another_board_cannot_take_the_room_over(client):
    with connect(client, "ABCD", "board", "b1") as b1, connect(client, "ABCD", "pad", "p1") as pad:
        skip(b1, pad, b1)
        with connect(client, "ABCD", "board", "intruder") as b2:
            assert closed_with(b2) == (4004, "room taken")
        pad.send_json({"t": "hi"})
        assert recv(b1) == {"t": "hi", "from": "p1"}   # the game goes on with its own board
    # once the board has left, the room is free again
    with connect(client, "ABCD", "board", "b2") as b2:
        assert recv(b2)["role"] == "board"


def test_pages_from_other_sites_are_refused(client):
    with client.websocket_connect(f"{WS}/ABCD?role=pad&id=p1", headers={"origin": "https://evil.example"}) as ws:
        assert closed_with(ws) == (4000, "origin")
    with client.websocket_connect(f"{WS}/ABCD?role=pad&id=p1", headers={"origin": "http://testserver"}) as ws:
        assert recv(ws)["t"] == "relay"                # the app's own page (same host) is welcome


def test_connections_from_one_address_are_rate_limited(client, monkeypatch):
    monkeypatch.setattr(duo, "JOINS_PER_MIN", 3)
    clock = [1000.0]
    monkeypatch.setattr(duo, "_now", lambda: clock[0])
    for k in range(3):
        with connect(client, "ABCD", "pad", f"p{k}") as ws:
            assert recv(ws)["t"] == "relay"
    with connect(client, "ABCD", "pad", "p9") as ws:
        assert closed_with(ws) == (4005, "too many connections")
    clock[0] += 61
    with connect(client, "ABCD", "pad", "p9") as ws:
        assert recv(ws)["t"] == "relay"


def test_pad_with_the_same_id_replaces_its_old_socket(client):
    with connect(client, "ABCD", "board", "b1") as board, connect(client, "ABCD", "pad", "p1") as old:
        skip(board, old, board)
        with connect(client, "ABCD", "pad", "p1") as new:
            assert closed_with(old) == (4001, "replaced")
            assert recv(new)["peers"] == [{"role": "board", "id": "b1"}]
            assert recv(board) == peer("leave", "pad", "p1")
            assert recv(board) == peer("join", "pad", "p1")
            old.send_json({"t": "stale"})              # the replaced socket is ignored
            new.send_json({"t": "fresh"})
            assert recv(board) == {"t": "fresh", "from": "p1"}
            board.send_json({"t": "to-p1", "to": "p1"})
            assert recv(new) == {"t": "to-p1", "to": "p1"}


def test_fifth_pad_is_turned_away(client):
    with ExitStack() as stack:
        board = stack.enter_context(connect(client, "FULL", "board", "b"))
        recv(board)
        pads = {}
        for i in range(1, 5):
            pads[i] = stack.enter_context(connect(client, "FULL", "pad", f"p{i}"))
            recv(pads[i])
            assert recv(board) == peer("join", "pad", f"p{i}")
        with connect(client, "FULL", "pad", "p5") as fifth:
            assert closed_with(fifth) == (4002, "room full")
        # a known pad may still reconnect into a full room
        with connect(client, "FULL", "pad", "p2") as again:
            assert recv(again)["role"] == "pad"
            assert closed_with(pads[2]) == (4001, "replaced")
            assert recv(board) == peer("leave", "pad", "p2")   # nothing was said about p5
            assert recv(board) == peer("join", "pad", "p2")
        assert recv(board) == peer("leave", "pad", "p2")
        assert sorted(duo._rooms["FULL"].pads) == ["p1", "p3", "p4"]


@pytest.mark.parametrize("query, reason", [
    ("abcd?role=pad&id=p1", "invalid room"),          # upper case only
    ("ABC?role=pad&id=p1", "invalid room"),           # 4…8 characters
    ("ABCDEFGHJ?role=pad&id=p1", "invalid room"),
    ("AB0D?role=pad&id=p1", "invalid room"),          # no 0 / 1
    ("AB1D?role=pad&id=p1", "invalid room"),
    ("ABCD?role=viewer&id=p1", "invalid role"),
    ("ABCD?id=p1", "invalid role"),
    ("ABCD?role=pad", "invalid id"),
    ("ABCD?role=pad&id=" + "x" * 33, "invalid id"),
    ("ABCD?role=board&id=two%20words", "invalid id"),
    ("ABCD?role=pad&id=p1%0A", "invalid id"),         # whole-string match, no trailing newline
])
def test_invalid_parameters_are_refused(client, query, reason):
    with client.websocket_connect(f"{WS}/{query}") as ws:
        assert closed_with(ws) == (4000, reason)
    assert duo._rooms == {}


def test_relay_errors(client):
    def sized(n, ch="a"):
        """A JSON object of exactly n UTF-8 bytes (ch is 1 or 2 bytes)."""
        head, tail = '{"t":"big","s":"', '"}'
        return head + ch * ((n - len(head) - len(tail)) // len(ch.encode())) + tail

    with connect(client, "ERRS", "pad", "p1") as pad:
        recv(pad)
        pad.send_json({"t": "tap"})
        assert recv(pad) == {"t": "relay-error", "error": "no_board"}
        with connect(client, "ERRS", "board", "b1") as board:
            skip(board, pad)
            for bad in ("not json", "[1, 2]", "42", '"text"', "null", '{"x": NaN}', ""):
                board.send_text(bad)
                assert recv(board) == {"t": "relay-error", "error": "bad_json"}, bad
            board.send_bytes(b'{"t": "binary"}')
            assert recv(board) == {"t": "relay-error", "error": "bad_json"}
            board.send_json({"t": "go", "to": "ghost"})
            assert recv(board) == {"t": "relay-error", "error": "no_pad", "to": "ghost"}

            limit = duo.MAX_FRAME
            assert len(sized(limit).encode()) == limit
            pad.send_text(sized(limit))                       # exactly 16 KiB passes
            assert recv(board)["from"] == "p1"
            pad.send_text(sized(limit + 1))
            assert recv(pad) == {"t": "relay-error", "error": "too_big"}
            two_byte = sized(limit + 2, "ż")                  # under the limit in characters, over it in bytes
            assert len(two_byte) < limit < len(two_byte.encode())
            pad.send_text(two_byte)
            assert recv(pad) == {"t": "relay-error", "error": "too_big"}
            board.send_bytes(b"x" * (limit + 1))
            assert recv(board) == {"t": "relay-error", "error": "too_big"}
            pad.send_json({"t": "still-works"})
            assert recv(board) == {"t": "still-works", "from": "p1"}


def test_flood_guard_drops_the_excess_and_keeps_the_order(client, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(duo, "_now", lambda: clock[0])   # frozen: no refill during the burst
    real_on_frame = duo._on_frame

    def on_frame(c, msg):
        if msg.get("text") == "TICK":                     # advance the clock exactly after the burst
            clock[0] += 1.0
            return
        real_on_frame(c, msg)

    monkeypatch.setattr(duo, "_on_frame", on_frame)
    with connect(client, "FLOOD", "board", "b") as board, connect(client, "FLOOD", "pad", "p") as pad:
        skip(board, pad, board)
        burst = int(duo.BURST)
        for i in range(burst + 50):
            pad.send_json({"i": i})
        pad.send_text("TICK")
        pad.send_json({"i": "late"})
        assert [recv(board)["i"] for _ in range(burst + 1)] == list(range(burst)) + ["late"]


def test_a_dead_or_stuck_socket_cannot_break_the_room():
    class Dead:
        async def send_text(self, text):
            raise RuntimeError("socket closed")

        async def close(self, code, reason):
            raise RuntimeError("socket closed")

    class Stuck:
        def __init__(self):
            self.sent = []

        async def send_text(self, text):
            self.sent.append(text)

        async def close(self, code, reason):
            self.sent.append((code, reason))

    async def main():
        dead = duo._Client(Dead(), "pad", "p1")
        dead.send("x")
        await asyncio.wait_for(dead.pump(), 1)   # returns instead of raising
        assert dead.closing
        dead.send("y")                           # ignored
        dead.close(4001, "replaced")             # no error

        ws = Stuck()
        slow = duo._Client(ws, "pad", "p2")
        for i in range(duo.OUTBOX_MAX + 1):      # nobody drained the outbox
            slow.send(str(i))
        await asyncio.wait_for(slow.pump(), 1)
        assert ws.sent == [(4003, "too slow")]

    asyncio.run(main())


# ─── /info ────────────────────────────────────────────────────────────

def test_info(client, monkeypatch, tmp_path):
    monkeypatch.setattr(duo, "lan_addresses", lambda: ["192.168.1.20", "10.0.0.5"])
    monkeypatch.setattr(duo.socket, "gethostname", lambda: "board-pc")
    monkeypatch.setattr(duo, "APP_DIR", tmp_path)
    monkeypatch.setenv("BRAINLINK_PORT", "9000")
    assert client.get("/api/v1/duo/info").json() == {
        "port": 9000,
        "app": False,
        "app_path": "/app/",
        "lan": ["http://192.168.1.20:9000/app/", "http://10.0.0.5:9000/app/"],
        "hostname": "board-pc",
    }
    (tmp_path / "index.html").write_text("<!doctype html>")
    monkeypatch.delenv("BRAINLINK_PORT")
    info = client.get("/api/v1/duo/info").json()
    assert info["app"] is True and info["port"] == 8420
    assert info["lan"][0] == "http://192.168.1.20:8420/app/"
    monkeypatch.setenv("BRAINLINK_PORT", "not-a-port")
    assert client.get("/api/v1/duo/info").json()["port"] == 8420


def test_lan_addresses_are_ranked_and_discovery_never_raises(monkeypatch):
    assert duo._rank_addresses([
        "127.0.1.1", "100.101.1.2", "192.168.1.20", "169.254.3.4", "10.0.0.7",
        "192.168.1.20", "0.0.0.0", "fe80::1", "garbage", "172.20.0.3", "224.0.0.1",
    ]) == ["192.168.1.20", "10.0.0.7", "172.20.0.3", "100.101.1.2", "169.254.3.4"]

    real = duo.lan_addresses()                   # whatever this machine has, it is a clean list
    assert all(isinstance(a, str) and not a.startswith("127.") for a in real)

    def boom(*_a, **_k):
        raise OSError("no network")

    monkeypatch.setattr(duo.socket, "socket", boom)
    monkeypatch.setattr(duo.socket, "getaddrinfo", boom)
    assert duo.lan_addresses() == []
    assert duo.lan_urls(8420) == []


# ─── /app/ ────────────────────────────────────────────────────────────

def test_app_page_when_the_build_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(duo, "APP_DIR", tmp_path / "missing")
    app = FastAPI()
    assert duo.mount_app(app) is False
    c = TestClient(app)
    for path in ("/app", "/app/"):
        r = c.get(path, follow_redirects=False)
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
        assert "cd web && npm ci && npm run build:desktop" in html.unescape(r.text)
        assert "http" not in r.text and "<script" not in r.text    # self-contained


def test_app_is_served_from_the_build(monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><title>Emmanuel</title>")
    (tmp_path / "app.js").write_text("console.log(1)")
    monkeypatch.setattr(duo, "APP_DIR", tmp_path)
    app = FastAPI()
    assert duo.mount_app(app) is True
    c = TestClient(app)
    assert "<title>Emmanuel</title>" in c.get("/app/").text
    assert c.get("/app").text == c.get("/app/").text           # redirected to /app/
    assert c.get("/app/app.js").text == "console.log(1)"


def test_server_includes_the_relay_and_the_app_route():
    import server
    paths = {getattr(r, "path", None) for r in server.app.routes}
    assert {"/api/v1/duo/info", "/api/v1/duo/ws/{room}", "/app"} <= paths
    assert server.APP_BUILT == duo.app_built()
