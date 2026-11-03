"""
FastAPI router for two-screen games: a message relay on the local network.

In a two-screen game one device, the *board* (usually the computer running this
server), shows the instructions and a phone or tablet on the same Wi-Fi, the
*pad*, is the touch controller.  Browsers do not let the HTTPS-hosted app open
``ws://`` connections, so for two devices this server serves the app itself
over plain HTTP on the LAN (``/app/``, see ``mount_app``) and passes the JSON
messages between the board and its pads.  That way the app needs no cloud
service: messages never leave the local network, and the relay keeps nothing;
a room exists only while someone is connected to it.

The relay is transparent: it does not interpret game messages and it passes
them on in the order they arrive.  Game timing is the clients' job (they run
their own clock sync over the relay).  Everything lives under ``/api/v1/duo``;
the relay is ``ws://…/api/v1/duo/ws/{room}?role=board|pad&id=…``.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import re
import socket
import time
from collections import deque
from functools import partial
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from fastapi import APIRouter, FastAPI, Query, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

log = logging.getLogger("brainlink.duo")

router = APIRouter(prefix="/api/v1/duo", tags=["Duo (two-screen games)"])

DEFAULT_PORT = 8420
APP_DIR = Path(__file__).resolve().parents[1] / "web" / "dist-desktop"   # `npm run build:desktop`
APP_PATH = "/app/"
BUILD_CMD = "cd web && npm ci && npm run build:desktop"

ROOM_RE = re.compile(r"[A-Z2-9]{4,8}")
ID_RE = re.compile(r"[A-Za-z0-9_-]{1,32}")
MAX_PADS = 4
MAX_FRAME = 16 * 1024      # bytes per message
RATE = 200.0               # flood guard: messages per second per connection…
BURST = 200.0              # …with this many allowed at once
OUTBOX_MAX = 1024          # frames queued for a client that is not reading → it is dropped
JOINS_PER_MIN = 60         # connections per client address per minute: room codes are short, so no guessing at speed

# Close codes (4000–4999 are free for applications)
CLOSE_INVALID = 4000       # bad room code, role or id
CLOSE_REPLACED = 4001      # the same board / pad id connected again
CLOSE_FULL = 4002          # room already has MAX_PADS pads
CLOSE_TOO_SLOW = 4003      # more than OUTBOX_MAX frames waiting for this client
CLOSE_TAKEN = 4004         # the room already has a board with another id
CLOSE_BUSY = 4005          # too many connections from this address in the last minute

_now = time.monotonic      # the clock the flood guard uses (tests freeze it)
_dumps = partial(json.dumps, ensure_ascii=False, separators=(",", ":"))


def _error(code: str, **extra) -> str:
    return _dumps({"t": "relay-error", "error": code, **extra})


ERR_TOO_BIG = _error("too_big")
ERR_BAD_JSON = _error("bad_json")
ERR_NO_BOARD = _error("no_board")


# ─── Rooms ────────────────────────────────────────────────────────────

class _Client:
    """One socket.  Everything sent to it goes through its outbox, in order."""

    def __init__(self, ws: WebSocket, role: str, cid: str):
        self.ws, self.role, self.id = ws, role, cid
        self.room: Optional[_Room] = None
        self.outbox: asyncio.Queue = asyncio.Queue(maxsize=OUTBOX_MAX)
        self.closing = False
        self.tokens, self.stamp = BURST, _now()

    def send(self, text: str) -> None:
        """Queue a frame.  Never blocks and never raises, so one dead socket cannot stall a room."""
        if self.closing:
            return
        try:
            self.outbox.put_nowait(text)
        except asyncio.QueueFull:
            self.close(CLOSE_TOO_SLOW, "too slow")

    def close(self, code: int, reason: str) -> None:
        """Drop whatever is still queued and send the close frame next."""
        if self.closing:
            return
        self.closing = True
        while not self.outbox.empty():
            self.outbox.get_nowait()
        self.outbox.put_nowait((code, reason))

    def allow(self) -> bool:
        """Token bucket: about RATE frames per second; the rest is dropped silently."""
        now = _now()
        self.tokens = min(BURST, self.tokens + (now - self.stamp) * RATE)
        self.stamp = now
        if self.tokens < 1.0:
            return False
        self.tokens -= 1.0
        return True

    async def pump(self) -> None:
        """Writer task: the only place that writes to the socket."""
        try:
            while True:
                item = await self.outbox.get()
                if isinstance(item, tuple):
                    await self.ws.close(*item)
                    return
                await self.ws.send_text(item)
        except Exception:
            # The socket is gone.  The reader gets the disconnect and does the clean-up.
            self.closing = True


class _Room:
    def __init__(self, code: str):
        self.code = code
        self.board: Optional[_Client] = None
        self.pads: dict[str, _Client] = {}


# Room bookkeeping (_join / _leave) is plain synchronous code: on the single
# event loop two of them can never interleave, and nothing in them can suspend
# half-way, so concurrent joins cannot race.  Sends only queue frames, so this
# also holds while messages are being delivered.  Keep it free of `await`.
_rooms: dict[str, _Room] = {}


def _peer(event: str, c: _Client) -> str:
    return _dumps({"t": "peer", "event": event, "role": c.role, "id": c.id})


def _welcome(room: _Room, c: _Client) -> str:
    if c.role == "board":
        peers = [{"role": "pad", "id": p.id} for p in room.pads.values()]
    else:
        peers = [{"role": "board", "id": room.board.id}] if room.board else []
    return _dumps({"t": "relay", "room": room.code, "role": c.role, "id": c.id, "peers": peers})


def _join(code: str, c: _Client) -> Optional[tuple[int, str]]:
    """Register a client (replacing an older socket with the same slot).  The close code and reason if refused.

    A board may only replace a board with the same id (its own reconnect): someone else who learns the
    room code cannot take the game over while its board is connected.
    """
    room = _rooms.get(code) or _Room(code)
    if c.role == "pad" and c.id not in room.pads and len(room.pads) >= MAX_PADS:
        return CLOSE_FULL, "room full"
    if c.role == "board" and room.board is not None and room.board.id != c.id:
        return CLOSE_TAKEN, "room taken"
    _rooms[code] = room
    c.room = room
    if c.role == "board":
        old, room.board = room.board, c
        others = list(room.pads.values())
    else:
        old, room.pads[c.id] = room.pads.get(c.id), c
        others = [room.board] if room.board else []
    c.send(_welcome(room, c))      # first frame the new client sees
    if old is not None:
        old.close(CLOSE_REPLACED, "replaced")
    for o in others:
        if old is not None:
            o.send(_peer("leave", old))
        o.send(_peer("join", c))
    return None


def _leave(c: _Client) -> None:
    """Unregister a client that disconnected (no-op if it was replaced meanwhile)."""
    room = c.room
    if room is None:
        return
    if c.role == "board" and room.board is c:
        room.board = None
        for p in room.pads.values():
            p.send(_peer("leave", c))
    elif c.role == "pad" and room.pads.get(c.id) is c:
        del room.pads[c.id]
        if room.board:
            room.board.send(_peer("leave", c))
    if room.board is None and not room.pads and _rooms.get(room.code) is room:
        del _rooms[room.code]      # empty rooms are forgotten


def _reject_constant(name: str):
    raise ValueError(f"{name} is not JSON")   # NaN / Infinity: browsers' JSON.parse rejects them


def _on_frame(c: _Client, msg: dict) -> None:
    """Route one incoming frame (synchronous: it only queues frames)."""
    if c.closing or not c.allow():   # a replaced socket may still be talking: ignore it
        return
    text = msg.get("text")
    if text is None:   # binary frame
        size = len(msg.get("bytes") or b"")
    else:
        size = len(text) if text.isascii() else len(text.encode("utf-8"))
    if size > MAX_FRAME:
        c.send(ERR_TOO_BIG)
        return
    try:
        obj = json.loads(text, parse_constant=_reject_constant) if text is not None else None
    except (ValueError, RecursionError):
        obj = None
    if not isinstance(obj, dict):
        c.send(ERR_BAD_JSON)
        return

    room = c.room
    if c.role == "pad":
        if room.board is None:
            c.send(ERR_NO_BOARD)
            return
        obj["from"] = c.id                 # the board always knows which pad spoke
        room.board.send(_dumps(obj))
        return
    to = obj.get("to")
    if to is None:
        for p in room.pads.values():
            p.send(text)                   # passed on byte for byte
        return
    pad = room.pads.get(to) if isinstance(to, str) else None
    if pad is None:
        c.send(_error("no_pad", to=to))
    else:
        pad.send(text)


_joins: dict[str, deque] = {}


def _too_many(addr: str) -> bool:
    """Count a connection from `addr`; True when it is over JOINS_PER_MIN in the last minute."""
    now = _now()
    q = _joins.setdefault(addr, deque())
    while q and now - q[0] > 60.0:
        q.popleft()
    if len(q) >= JOINS_PER_MIN:
        return True
    q.append(now)
    if len(_joins) > 4096:                       # forget idle addresses
        for a in [a for a, d in _joins.items() if not d or now - d[-1] > 60.0]:
            del _joins[a]
    return False


def _foreign_origin(ws: WebSocket) -> bool:
    """A browser page from another site (its Origin is not this server): the relay serves only its own app."""
    origin = ws.headers.get("origin")
    if not origin:
        return False                             # not a browser (tests, tools)
    return urlsplit(origin).netloc.lower() != (ws.headers.get("host") or "").lower()


def _invalid(room: str, role: str, cid: str) -> Optional[str]:
    if not ROOM_RE.fullmatch(room):
        return "invalid room"
    if role not in ("board", "pad"):
        return "invalid role"
    if not ID_RE.fullmatch(cid):
        return "invalid id"
    return None


@router.websocket("/ws/{room}")
async def duo_ws(ws: WebSocket, room: str, role: str = "", client_id: str = Query("", alias="id")):
    await ws.accept()   # accept first so the client gets a close code and reason, not a failed handshake
    if _foreign_origin(ws):
        await ws.close(CLOSE_INVALID, "origin")
        return
    if _too_many(ws.client.host if ws.client else ""):
        await ws.close(CLOSE_BUSY, "too many connections")
        return
    problem = _invalid(room, role, client_id)
    if problem:
        await ws.close(CLOSE_INVALID, problem)
        return
    c = _Client(ws, role, client_id)
    refused = _join(room, c)
    if refused:
        await ws.close(*refused)
        return
    writer = asyncio.create_task(c.pump())
    try:
        while True:
            msg = await ws.receive()   # raw ASGI message: still works after we sent a close frame
            if msg["type"] == "websocket.disconnect":
                break
            _on_frame(c, msg)
    except Exception:
        log.warning("duo relay: connection %s/%s/%s ended with an error", room, role, client_id, exc_info=True)
    finally:
        _leave(c)
        writer.cancel()


# ─── Info: where the app can be reached on the LAN ────────────────────

def _port() -> int:
    try:
        return int(os.environ.get("BRAINLINK_PORT", DEFAULT_PORT))
    except ValueError:
        return DEFAULT_PORT


_RFC1918 = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")]


def _rank_addresses(candidates) -> list[str]:
    """Keep non-loopback IPv4 addresses, de-duplicated; home/office ranges first, link-local last."""
    seen: dict[str, int] = {}
    for a in candidates:
        try:
            ip = ipaddress.IPv4Address(a)
        except ValueError:
            continue
        if ip.is_loopback or ip.is_unspecified or ip.is_multicast or str(ip) in seen:
            continue
        seen[str(ip)] = 0 if any(ip in n for n in _RFC1918) else 2 if ip.is_link_local else 1
    return sorted(seen, key=seen.get)   # stable: discovery order within a group


def lan_addresses() -> list[str]:
    """This machine's LAN IPv4 addresses.  Never raises: an empty list when nothing is found."""
    found: list[str] = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("10.255.255.255", 1))   # UDP connect sends nothing; it picks the outgoing interface
            found.append(s.getsockname()[0])
        finally:
            s.close()
    except Exception:
        pass
    try:
        found += [ai[4][0] for ai in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)]
    except Exception:
        pass
    try:
        return _rank_addresses(found)
    except Exception:
        return []


def lan_urls(port: int) -> list[str]:
    return [f"http://{a}:{port}{APP_PATH}" for a in lan_addresses()]


def app_built() -> bool:
    return (APP_DIR / "index.html").is_file()


@router.get("/info")
async def duo_info():
    """Port, whether the web app is built, and its URLs on this machine's LAN addresses."""
    port = _port()
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = ""
    return {
        "port": port,
        "app": app_built(),
        "app_path": APP_PATH,
        "lan": await asyncio.to_thread(lan_urls, port),   # getaddrinfo can block on a bad hostname
        "hostname": hostname,
    }


# ─── Web app (desktop build) at /app/ ─────────────────────────────────

_NOT_BUILT_HTML = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emmanuel: app not built</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }}
  pre {{ padding: .75rem 1rem; border: 1px solid #8884; border-radius: 6px; overflow-x: auto; }}
</style></head>
<body>
<h1>The app is not built yet</h1>
<p>The desktop server serves the Emmanuel web app here for two-screen games, but
<code>web/dist-desktop/</code> does not exist. Build it once (needs Node.js), then restart the server:</p>
<pre>{BUILD_CMD.replace("&", "&amp;")}</pre>
<p><a href="/">Back to the dashboard</a></p>
</body></html>
"""


def mount_app(app: FastAPI) -> bool:
    """Serve ``web/dist-desktop`` at /app/, or a page saying how to build it.  True if the build was found."""
    if app_built():
        app.mount("/app", StaticFiles(directory=str(APP_DIR), html=True), name="app")
        return True

    async def app_not_built():
        return HTMLResponse(_NOT_BUILT_HTML)

    for path in ("/app", APP_PATH):
        app.add_api_route(path, app_not_built, methods=["GET"], include_in_schema=False)
    return False
